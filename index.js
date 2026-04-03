import express from 'express';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import logger from './core/utils/log.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);
const { spawn } = require('child_process');

// ── Express uptime / dashboard server ──────────────────────────────────────
const app  = express();
const port = process.env.PORT || 5000;

app.get('/', (_req, res) => res.sendFile(join(__dirname, 'core/web/index.html')));
app.listen(port, () => logger(`Dashboard running → http://localhost:${port}`, '[ SERVER ]'));

// ── Bot process management ─────────────────────────────────────────────────
let restartCount = 0;
const MAX_RESTARTS = 10;

function startBot(message) {
  if (message) logger(message, '[ STARTING ]');

  const child = spawn('node', ['--trace-warnings', '--async-stack-traces', 'core/main.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true,
  });

  child.on('close', (code) => {
    if (code !== 0 && restartCount < MAX_RESTARTS) {
      restartCount++;
      logger(`Process exited with code ${code}. Restarting (${restartCount}/${MAX_RESTARTS})…`, '[ STARTING ]');
      setTimeout(() => startBot(), 3000);
    } else if (restartCount >= MAX_RESTARTS) {
      logger('Max restarts reached. Please check logs and restart manually.', '[ ERROR ]');
    }
  });

  child.on('error', (err) => {
    logger(`Spawn error: ${err.message}`, '[ ERROR ]');
  });
}

startBot('Initializing bot…');