/**
 * index.js — Raiden Engine Entry Point
 *
 * Responsibilities:
 *  1. Print the boot banner
 *  2. Start the Express dashboard / uptime server
 *  3. Spawn core/main.js as a child process with auto-restart
 */

import express              from 'express';
import { createRequire }    from 'module';
import { fileURLToPath }    from 'url';
import { dirname, join }    from 'path';
import logger               from './core/utils/log.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);
const { spawn } = require('child_process');

// ── Boot banner ────────────────────────────────────────────────────────────
logger.banner();

// ── Express dashboard ──────────────────────────────────────────────────────
const app  = express();
const port = process.env.PORT || 5000;
const host = process.env.DOMAIN || `localhost`;

app.get('/', (_req, res) => res.sendFile(join(__dirname, 'core/web/index.html')));
app.listen(port, () => {
  logger(`Dashboard running on http://${host}:${port}`, 'RAIDEN');
});

// ── Bot process manager ────────────────────────────────────────────────────
const MAX_RESTARTS = 10;
let   restartCount = 0;

function startBot(message) {
  if (message) logger(message, 'RAIDEN');

  const child = spawn(
    'node',
    ['--trace-warnings', '--async-stack-traces', 'core/main.js'],
    { cwd: __dirname, stdio: 'inherit', shell: true },
  );

  child.on('close', (code) => {
    if (code === 0) return; // clean exit
    if (restartCount < MAX_RESTARTS) {
      restartCount++;
      logger(`Process crashed (code ${code}). Restarting ${restartCount}/${MAX_RESTARTS}…`, 'RAIDEN');
      setTimeout(() => startBot(), 3000);
    } else {
      logger.error(`Max restarts (${MAX_RESTARTS}) reached. Shutting down.`);
      process.exit(1);
    }
  });

  child.on('error', (err) => {
    logger.error(`Spawn error: ${err.message}`);
  });
}

startBot();
