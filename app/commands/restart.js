/**
 * restart.js
 * ----------
 * Restart the bot process. Requires PM2 (or any process manager) to be
 * configured to restart on exit code 2.
 *
 * On the next boot, the first incoming message triggers onEvent which reads
 * app/cache/restart.txt and reports downtime to the original thread.
 *
 * Place in: app/commands/restart.js
 */

import fs   from 'fs-extra';
import path from 'path';

const RESTART_FILE = path.resolve(process.cwd(), 'app/cache/restart.txt');

export const meta = {
  name:        'restart',
  aliases:     ['reboot', 'relaunch'],
  version:     '1.0.0',
  type:        'developer',
  author:      'NTKhang | Converted for Raiden by AjiroDesu',
  description: 'Restart the bot process. Requires PM2 or equivalent process manager.',
  category:    'developer',
  guide:       [''],
  cooldowns:   0,
};

export async function onStart({ event, response }) {
  fs.ensureDirSync(path.dirname(RESTART_FILE));
  fs.writeFileSync(RESTART_FILE, `${event.threadID} ${Date.now()}`, 'utf-8');

  await response.reply('🔄 Restarting bot… please wait a moment.');
  process.exit(2);
}

// ── onEvent ──────────────────────────────────────────────────────────────────
// Fires on every message event. Uses a session-level flag so the restart
// file is only checked once per boot, on the very first message received.

export async function onEvent({ api }) {
  if (global.client._restartChecked) return;
  global.client._restartChecked = true;

  if (!fs.existsSync(RESTART_FILE)) return;

  try {
    const raw             = fs.readFileSync(RESTART_FILE, 'utf-8').trim();
    const [tid, tsString] = raw.split(' ');
    fs.unlinkSync(RESTART_FILE);

    const elapsed = ((Date.now() - Number(tsString)) / 1000).toFixed(1);
    api.sendMessage(`✅ Bot restarted successfully!\n⏰ Downtime: ${elapsed}s`, tid);
  } catch {
    // Silently ignore corrupt/missing file
  }
}
