/**
 * devonly.js
 * ----------
 * Toggle "Developer Only" mode. When enabled, only ADMINBOT members can
 * interact with the bot — all other users get a silent ⚠️ reaction.
 *
 * The flag is stored in json/config.json as "DeveloperOnly": true/false.
 * The enforcement logic lives in core/handle/handleCommand.js.
 *
 * Place in: app/commands/devonly.js
 */

import fs from 'fs-extra';

export const meta = {
  name:        'devonly',
  aliases:     ['developeronly', 'devmode'],
  version:     '1.0.0',
  type:        'developer',
  author:      'NTKhang | Converted for Raiden by AjiroDesu',
  description: 'Toggle Developer Only mode — only ADMINBOT members can use the bot when enabled.',
  category:    'developer',
  guide: [
    'on        – enable Developer Only mode',
    'off       – disable Developer Only mode',
    'status    – show current status',
  ],
  cooldowns: 5,
};

export async function onStart({ args, response, usage }) {
  if (!args[0]) return usage();

  const sub = args[0].toLowerCase();

  if (sub === 'status') {
    const state = global.config.DeveloperOnly ? '🔒 ON' : '🔓 OFF';
    return response.reply(`Developer Only mode is currently: ${state}`);
  }

  if (sub !== 'on' && sub !== 'off') return usage();

  const value = sub === 'on';

  // Update in-memory config
  global.config.DeveloperOnly = value;

  // Persist to config.json
  try {
    const raw    = fs.readFileSync(global.client.configPath, 'utf-8');
    const config = JSON.parse(raw);
    config.DeveloperOnly = value;
    fs.writeFileSync(global.client.configPath, JSON.stringify(config, null, 4));
  } catch (err) {
    return response.reply(`❌ Failed to save config: ${err.message}`);
  }

  return response.reply(
    value
      ? '🔒 Developer Only mode is now ON.\nOnly ADMINBOT members can use the bot. All others will receive a ⚠️ reaction.'
      : '🔓 Developer Only mode is now OFF.\nAll users can interact with the bot normally.'
  );
}
