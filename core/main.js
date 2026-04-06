/**
 * core/main.js — Raiden Engine Core (fixed)
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import { format as utilFormat } from 'util';
import moment from 'moment-timezone';
import logger from './utils/log.js';
import { createDatabase } from './database/index.js';
import buildModels from './database/model.js';
import createListener from './system/listen.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const login = require('stfca');

// ── Console Intercept ─────────────────────────────────────────────────────
{
  const _origLog = console.log.bind(console);
  globalThis.__rawConsoleLog = _origLog;

  const routeExternal = () => (...args) => {
    logger.external(utilFormat(...args), 'RAIDEN');
  };

  console.log = routeExternal();
  console.info = routeExternal();
  console.debug = routeExternal();
  console.warn = routeExternal();
  console.error = routeExternal();
}

// ── Suppress noisy Node.js / stfca deprecation warnings ──────────────────
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  // Silently drop DEP warnings originating from node_modules (stfca, bluebird, request)
  const stack = warning.stack || '';
  if (
    warning.name === 'DeprecationWarning' &&
    (stack.includes('node_modules') || !stack)
  ) return;
  // Pass through any other warnings normally
  logger(`[${warning.name}] ${warning.message}`, 'WARN');
});

// ── Boot Log ──────────────────────────────────────────────────────────────
logger('Activating the Engine Protocols', 'RAIDEN');

// ── Globals ───────────────────────────────────────────────────────────────
global.client = {
  commands: new Map(),
  events: new Map(),
  cooldowns: new Map(),
  eventRegistered: [],
  onReply: [],
  onReaction: [],
  mainPath: process.cwd(),
  api: null,
  timeStart: Date.now(),

  // ✅ FIXED PATHS
  configPath: resolve(process.cwd(), "json/config.json"),
  configCmdPath: resolve(process.cwd(), "json/configCmd.json")
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

global.config = {};
global.endpoint = {};
global.configCmd = {};

// ── Config ────────────────────────────────────────────────────────────────
try {
  global.config = JSON.parse(readFileSync(global.client.configPath, 'utf-8'));
} catch (e) {
  logger.error(`Cannot read config.json: ${e.message}`);
  process.exit(1);
}

// ── Config Commands ───────────────────────────────────────────────────────
try {
  global.configCmd = JSON.parse(readFileSync(global.client.configCmdPath, 'utf-8'));
} catch (e) {
  logger.error(`Cannot read configCmd.json: ${e.message}`);
  process.exit(1);
}

// ── Endpoint ──────────────────────────────────────────────────────────────
const endpointPath = resolve(process.cwd(), 'json/endpoint.json');
try {
  global.endpoint = JSON.parse(readFileSync(endpointPath, 'utf-8'));
} catch {
  global.endpoint = {};
}

// ── Appstate ──────────────────────────────────────────────────────────────
const appstatePath = resolve(process.cwd(), global.config.APPSTATEPATH || 'json/appstate.json');
let appState;
try {
  appState = JSON.parse(readFileSync(appstatePath, 'utf-8'));
} catch (e) {
  logger.error(`Cannot read appstate: ${e.message}`);
  process.exit(1);
}

// ── Database ──────────────────────────────────────────────────────────────
const { sequelize, Sequelize } = createDatabase(global.config);
try {
  await sequelize.authenticate();
} catch (e) {
  logger.error(`Database connection failed: ${e.message}`);
  process.exit(1);
}
const models = buildModels({ sequelize, Sequelize });

// ── AI Engine ─────────────────────────────────────────────────────────────
if (global.config.GROQ_API_KEY || process.env.GROQ_API_KEY) {
  logger('Groq AI engine connected.', 'RAIDEN');
} else {
  logger.warn('GROQ_API_KEY not set — AI features disabled.');
}

// ── Module Loader ─────────────────────────────────────────────────────────
async function loadModules(dir, map, type) {
  const isCommand = type === 'command';
  const TAG = isCommand ? 'COMMANDS' : 'EVENT';
  const disabled = isCommand
    ? (global.config.commandDisabled || [])
    : (global.config.eventDisabled || []);

  const files = readdirSync(dir).filter(
    f => f.endsWith('.js') && !disabled.includes(f)
  );

  logger.section(`SCANNING ${isCommand ? 'COMMANDS' : 'EVENTS'}`);
  logger(`${isCommand ? 'command' : 'event'} path: ${dir}`, 'RAIDEN');

  for (const file of files) {
    logger(`scanned ${file}`, TAG);
  }

  logger.section(`DEPLOYING ${isCommand ? 'COMMANDS' : 'EVENTS'}`);

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const mod = await import(pathToFileURL(filePath).href);

      if (!mod.meta) throw new Error(`Missing meta`);

      if (isCommand) {
        if (typeof mod.onStart !== 'function') throw new Error('Missing onStart');
        map.set(mod.meta.name, mod);
        // Register commands that also listen to events (e.g. rankup, help)
        if (typeof mod.onEvent === 'function') {
          global.client.eventRegistered.push(mod.meta.name);
        }
      } else {
        if (typeof mod.onEvent !== 'function') throw new Error('Missing onEvent');
        map.set(mod.meta.name, mod);
      }

      logger(`Deployed ${mod.meta.name}`, TAG);
    } catch (e) {
      logger.error(`Failed to deploy "${file}": ${e.message}`);
    }
  }
}

const commandsDir = resolve(process.cwd(), 'app/commands');
const eventsDir = resolve(process.cwd(), 'app/events');

await loadModules(commandsDir, global.client.commands, 'command');
await loadModules(eventsDir, global.client.events, 'event');

// ── Dashboard ─────────────────────────────────────────────────────────────
logger.section('DASHBOARD SERVER ONLINE');

// ── Login ─────────────────────────────────────────────────────────────────
login({ appState }, async (err, api) => {
  if (err) {
    logger.error(`Login failed: ${JSON.stringify(err)}`);
    return process.exit(1);
  }

  if (global.config.FCAOption) api.setOptions(global.config.FCAOption);

  writeFileSync(appstatePath, JSON.stringify(api.getAppState(), null, 2));

  global.client.api = api;
  global.client.timeStart = Date.now();

  const botID = api.getCurrentUserID();
  const botName = global.config.BOTNAME || 'Raiden';

  logger(`Logged as ${botID}`, 'LOGIN');
  logger(`${botName} is online`, 'LOGIN');

  const listener = await createListener({ api, models });

  global.handleListen = api.listenMqtt((error, event) => {
    if (error) return logger.error(`Listener error: ${JSON.stringify(error)}`);
    listener(event);
  });

  api.markAsReadAll?.();
});

// ── Global Error Catch ─────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason?.message || reason}`);
});