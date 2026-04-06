/**
 * index.js — Raiden Engine Entry Point
 *
 * Responsibilities:
 *  1. Print the boot banner
 *  2. Start the Express dashboard + /api/stats endpoint
 *  3. Spawn core/main.js as a child process with auto-restart
 */

import express           from 'express';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFileSync, readdirSync, existsSync } from 'fs';
import logger            from './core/utils/log.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);
const { spawn } = require('child_process');
const sqlite3   = require('sqlite3').verbose();

// ── Boot banner ────────────────────────────────────────────────────────────
logger.banner();

// ── Bot process state ──────────────────────────────────────────────────────
let botStatus    = 'starting';
let botStartedAt = Date.now();

// ── Helpers ────────────────────────────────────────────────────────────────

function safeReadConfig() {
  try {
    const raw = readFileSync(join(__dirname, 'json/config.json'), 'utf-8');
    const cfg = JSON.parse(raw);
    const HIDDEN = ['GROQ_API_KEY', 'APPSTATEPATH', 'DATABASE', 'FCAOption'];
    for (const k of HIDDEN) delete cfg[k];
    return cfg;
  } catch { return {}; }
}

function parseMeta(filePath, type) {
  try {
    const src     = readFileSync(filePath, 'utf-8');
    const get     = (k) => src.match(new RegExp(`${k}\\s*:\\s*['"\`]([^'"\`\n]+)['"\`]`))?.[1] || '';
    const evtT    = src.match(/eventType\s*:\s*\[([^\]]+)\]/)?.[1]
                      ?.split(',').map(s => s.trim().replace(/['"`]/g, '')).filter(Boolean) || [];
    const aliases = src.match(/aliases\s*:.*?\[([^\]]*)\]/s)?.[1]
                      ?.split(',').map(s => s.trim().replace(/['"`\s]/g, '')).filter(Boolean) || [];
    return {
      name:        get('name') || filePath.split('/').pop().replace('.js',''),
      description: get('description') || '',
      category:    get('category')    || (type === 'event' ? 'event' : 'misc'),
      type:        get('type')        || 'anyone',
      version:     get('version')     || '1.0.0',
      author:      get('author')      || '',
      aliases,
      ...(type === 'event' ? { eventType: evtT } : {}),
    };
  } catch { return { name: filePath.split('/').pop().replace('.js','') }; }
}

function scanDir(dir, type) {
  try {
    return readdirSync(dir).filter(f => f.endsWith('.js'))
      .map(f => parseMeta(join(dir, f), type));
  } catch { return []; }
}

function getDbStats() {
  return new Promise((res) => {
    const dbPath = resolve(__dirname, 'core/database/data.sqlite');
    if (!existsSync(dbPath)) return res({ threads: 0, users: 0 });
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return res({ threads: 0, users: 0 });
    });
    db.get('SELECT COUNT(*) AS cnt FROM Threads', (_e1, r1) => {
      const threads = r1?.cnt || 0;
      db.get('SELECT COUNT(*) AS cnt FROM Users', (_e2, r2) => {
        const users = r2?.cnt || 0;
        db.close();
        res({ threads, users });
      });
    });
  });
}

function formatUptime(ms) {
  const s   = Math.floor(ms / 1000);
  const d   = Math.floor(s / 86400);
  const h   = Math.floor((s % 86400) / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p   = [];
  if (d)   p.push(`${d}d`);
  if (h)   p.push(`${h}h`);
  if (m)   p.push(`${m}m`);
  p.push(`${sec}s`);
  return p.join(' ');
}

// ── Express ────────────────────────────────────────────────────────────────
const app  = express();
const port = process.env.PORT || 5000;
const host = process.env.DOMAIN || 'localhost';

app.get('/', (_req, res) =>
  res.sendFile(join(__dirname, 'core/web/index.html'))
);

app.get('/api/stats', async (_req, res) => {
  try {
    const cfg      = safeReadConfig();
    const commands = scanDir(join(__dirname, 'app/commands'), 'command');
    const events   = scanDir(join(__dirname, 'app/events'),   'event');
    const db       = await getDbStats();
    const uptime   = Date.now() - botStartedAt;
    res.json({
      status:    botStatus,
      uptime,
      uptimeStr: formatUptime(uptime),
      botName:   cfg.BOTNAME || 'Raiden',
      prefix:    cfg.PREFIX  || '+',
      stats:     { commands: commands.length, events: events.length, threads: db.threads, users: db.users },
      config:    cfg,
      commands,
      events,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, () =>
  logger(`Dashboard running on http://${host}:${port}`, 'RAIDEN')
);

// ── Bot process manager ────────────────────────────────────────────────────
const MAX_RESTARTS = 10;
let   restartCount = 0;

function startBot(msg) {
  if (msg) logger(msg, 'RAIDEN');
  botStatus    = 'starting';
  botStartedAt = Date.now();

  const child = spawn('node',
    ['--trace-warnings', '--async-stack-traces', 'core/main.js'],
    { cwd: __dirname, stdio: 'inherit', shell: true }
  );

  setTimeout(() => { if (botStatus === 'starting') botStatus = 'online'; }, 5000);

  child.on('close', (code) => {
    if (code === 0) { botStatus = 'offline'; return; }
    botStatus = 'restarting';
    if (restartCount < MAX_RESTARTS) {
      restartCount++;
      logger(`Process crashed (code ${code}). Restarting ${restartCount}/${MAX_RESTARTS}…`, 'RAIDEN');
      setTimeout(() => startBot(), 3000);
    } else {
      botStatus = 'crashed';
      logger.error(`Max restarts (${MAX_RESTARTS}) reached. Shutting down.`);
      process.exit(1);
    }
  });

  child.on('error', (err) => {
    botStatus = 'crashed';
    logger.error(`Spawn error: ${err.message}`);
  });
}

startBot();