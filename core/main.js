import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve, dirname }                   from 'path';
import { fileURLToPath, pathToFileURL }             from 'url';
import { createRequire }                            from 'module';
import chalk                                        from 'chalk';
import moment                                       from 'moment-timezone';
import logger                                       from './utils/log.js';
import { createDatabase }                           from './database/index.js';
import buildModels                                  from './database/model.js';
import createListener                               from './system/listen.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);
const login     = require('stfca');

// ── Globals ───────────────────────────────────────────────────────────────
global.client = {
  commands:        new Map(),
  events:          new Map(),
  cooldowns:       new Map(),
  eventRegistered: [],
  onReply:         [],
  onReaction:      [],
  mainPath:        process.cwd(),
  api:             null,
  timeStart:       Date.now(),
};

global.data = {
  threadInfo:      new Map(),
  threadData:      new Map(),
  userName:        new Map(),
  userBanned:      new Map(),
  threadBanned:    new Map(),
  commandBanned:   new Map(),
  threadAllowNSFW: [],
  allUserID:       [],
  allCurrenciesID: [],
  allThreadID:     [],
};

global.config       = {};
global.endpoint     = {};
global.configModule = {};


// ── Config ────────────────────────────────────────────────────────────────
const configPath = resolve(process.cwd(), 'json/config.json');
let configValue;
try {
  configValue = JSON.parse(readFileSync(configPath, 'utf-8'));
  logger.loader('Loaded config.json');
} catch (e) {
  logger.loader(`Cannot read config.json: ${e.message}`, 'error');
  process.exit(1);
}

global.config = configValue;

// ── Endpoint ──────────────────────────────────────────────────────────────
const endpointPath = resolve(process.cwd(), 'json/endpoint.json');
let endpointValue;
try {
  endpointValue = JSON.parse(readFileSync(endpointPath, 'utf-8'));
  logger.loader('Loaded endpoint.json');
} catch (e) {
  logger.loader(`Cannot read endpoint.json: ${e.message}`, 'error');
  process.exit(1);
}

global.endpoint = endpointValue;

// ── Appstate ──────────────────────────────────────────────────────────────
const appstatePath = resolve(process.cwd(), global.config.APPSTATEPATH || 'json/appstate.json');
let appState;
try {
  appState = JSON.parse(readFileSync(appstatePath, 'utf-8'));
  logger.loader(`Loaded appstate from: ${appstatePath}`);
} catch (e) {
  logger.loader(`Cannot read appstate: ${e.message} — run "npm run login" first.`, 'error');
  process.exit(1);
}

// ── Database ──────────────────────────────────────────────────────────────
const { sequelize, Sequelize } = createDatabase(global.config);
try {
  await sequelize.authenticate();
  logger.loader('Database connection established.');
} catch (e) {
  logger.loader(`Database connection failed: ${e.message}`, 'error');
  process.exit(1);
}
const models = buildModels({ sequelize, Sequelize });

// ── Dynamic command / event loader ────────────────────────────────────────
/**
 * Loads ESM modules from a directory into a Map.
 * Each file must export:
 *   export const meta   = { name, ... }
 *   export async function onStart(...)    (commands)
 *   export async function onEvent(...)    (events)
 */
async function loadModules(dir, map, type = 'command') {
  const disabled = type === 'command'
    ? (global.config.commandDisabled || [])
    : (global.config.eventDisabled   || []);

  const files = readdirSync(dir).filter(f => f.endsWith('.js') && !disabled.includes(f));

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const mod = await import(pathToFileURL(filePath).href);

      if (!mod.meta) throw new Error(`Missing "export const meta" in ${file}`);

      if (type === 'command') {
        if (typeof mod.onStart !== 'function') throw new Error(`Missing "export async function onStart" in ${file}`);
        if (map.has(mod.meta.name)) throw new Error(`Duplicate command name "${mod.meta.name}"`);
        map.set(mod.meta.name, mod);
        if (typeof mod.onEvent === 'function') global.client.eventRegistered.push(mod.meta.name);
      } else {
        if (typeof mod.onEvent !== 'function') throw new Error(`Missing "export async function onEvent" in ${file}`);
        if (map.has(mod.meta.name)) throw new Error(`Duplicate event name "${mod.meta.name}"`);
        map.set(mod.meta.name, mod);
      }

      logger.loader(`Loaded ${type}: ${mod.meta.name}`);
    } catch (e) {
      logger.loader(`Failed to load ${type} "${file}": ${e.message}`, 'error');
    }
  }
}

const commandsDir = resolve(process.cwd(), 'app/commands');
const eventsDir   = resolve(process.cwd(), 'app/events');

await loadModules(commandsDir, global.client.commands, 'command');
await loadModules(eventsDir,   global.client.events,   'event');

logger(
  `Loaded ${global.client.commands.size} commands, ${global.client.events.size} events.`,
  '[ LOADER ]',
);

// ── FCA Login ─────────────────────────────────────────────────────────────
logger('Logging in to Facebook…', '[ LOGIN ]');

login({ appState }, async (loginError, api) => {
  if (loginError) {
    logger(`Login failed: ${JSON.stringify(loginError)}`, 'error');
    return process.exit(1);
  }

  // Apply FCA options from config
  if (global.config.FCAOption) api.setOptions(global.config.FCAOption);

  // Persist refreshed appstate
  writeFileSync(appstatePath, JSON.stringify(api.getAppState(), null, 2));

  global.client.api       = api;
  global.client.timeStart = Date.now();

  logger(`Logged in as UID: ${api.getCurrentUserID()}`, '[ LOGIN ]');
  logger(`Bot name: ${global.config.BOTNAME || 'Raiden'} | Prefix: ${global.config.PREFIX}`, '[ INFO ]');

  // ── Start listener ──────────────────────────────────────────────────
  const listener = await createListener({ api, models });

  global.handleListen = api.listenMqtt((error, event) => {
    if (error) return logger(`Listener error: ${JSON.stringify(error)}`, 'error');
    listener(event);
  });

  // ── Mark all as read on startup ────────────────────────────────────
  api.markAsReadAll?.((err) => { if (err) console.error('[markAsReadAll]', err); });

  // ── Notify admins on startup ───────────────────────────────────────
  const admins = global.config.ADMINBOT || [];
  if (admins.length) {
    const time = moment().tz('Asia/Manila').format('HH:mm:ss MM/DD/YYYY');
    for (const adminID of admins) {
      api.sendMessage(
        `✅ ${global.config.BOTNAME || 'Raiden'} is online!\nTime: ${time}`,
        String(adminID),
        (err) => { if (err) console.error(`[startupNotify] Failed to notify ${adminID}:`, err); }
      );
    }
  }
});

// ── Unhandled rejections ───────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});