/**
 * ignoreonlydev.js
 * ----------------
 * Manage commands that are exempt from the global "Developer Only" mode.
 * When DeveloperOnly is enabled in config.json, commands on this list
 * remain usable by all users — effectively whitelisting them.
 *
 * The exempt list is stored in config.json under "DeveloperOnlyIgnore".
 * Enforcement is handled in core/handle/handleCommand.js.
 *
 * Subcommands:
 *   add <commandName>  – add a command to the exempt list
 *   del <commandName>  – remove a command from the exempt list
 *   list               – view the current exempt list
 *
 * Place in: app/commands/ignoreonlydev.js
 */

import fs from 'fs-extra';

export const meta = {
  name:        'ignoreonlydev',
  aliases:     ['ignoredevonly', 'devonlyignore', 'ignoredev'],
  version:     '1.0.0',
  type:        'developer',
  author:      'NTKhang | Converted for Raiden by AjiroDesu',
  description: 'Manage commands exempt from the global Developer Only restriction.',
  category:    'developer',
  guide: [
    'add <commandName>  – exempt a command from Developer Only mode',
    'del <commandName>  – remove a command from the exempt list',
    'list               – view all currently exempted commands',
  ],
  cooldowns: 5,
};

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Returns the live DeveloperOnlyIgnore array from global config.
 * Initialises it if missing so push/splice always work.
 */
function getIgnoreList() {
  if (!Array.isArray(global.config.DeveloperOnlyIgnore))
    global.config.DeveloperOnlyIgnore = [];
  return global.config.DeveloperOnlyIgnore;
}

/** Persist global.config to disk. */
function saveConfig(response) {
  try {
    fs.writeFileSync(
      global.client.configPath,
      JSON.stringify(global.config, null, 4)
    );
  } catch (err) {
    response.reply(`⚠️ Config saved in memory but could not be written to disk: ${err.message}`);
  }
}

// ── Command ───────────────────────────────────────────────────────────────────

export async function onStart({ args, response, usage }) {
  const sub         = args[0]?.toLowerCase();
  const ignoreList  = getIgnoreList();

  switch (sub) {

    // ── add ──────────────────────────────────────────────────────────────────
    case 'add': {
      const cmdName = args[1]?.toLowerCase();
      if (!cmdName)
        return response.reply('⚠️ Please enter the command name you want to add to the exempt list.');

      const command = global.client.commands.get(cmdName);
      if (!command)
        return response.reply(`❌ Command "${cmdName}" not found in the bot's command list.`);

      if (ignoreList.includes(cmdName))
        return response.reply(`❌ "${cmdName}" is already in the exempt list.`);

      ignoreList.push(cmdName);
      saveConfig(response);
      return response.reply(
        `✅ Added "${cmdName}" to the Developer Only exempt list.\n` +
        `Users can now use this command even when Developer Only mode is ON.`
      );
    }

    // ── del / remove ─────────────────────────────────────────────────────────
    case 'del':
    case 'delete':
    case 'remove':
    case 'rm':
    case '-d': {
      const cmdName = args[1]?.toLowerCase();
      if (!cmdName)
        return response.reply('⚠️ Please enter the command name you want to remove from the exempt list.');

      const command = global.client.commands.get(cmdName);
      if (!command)
        return response.reply(`❌ Command "${cmdName}" not found in the bot's command list.`);

      if (!ignoreList.includes(cmdName))
        return response.reply(`❌ "${cmdName}" is not in the exempt list.`);

      ignoreList.splice(ignoreList.indexOf(cmdName), 1);
      saveConfig(response);
      return response.reply(
        `✅ Removed "${cmdName}" from the Developer Only exempt list.\n` +
        `It is now restricted when Developer Only mode is ON.`
      );
    }

    // ── list ─────────────────────────────────────────────────────────────────
    case 'list': {
      if (!ignoreList.length)
        return response.reply('📑 Developer Only exempt list is empty.\nNo commands are currently whitelisted.');
      return response.reply(
        `📑 Commands exempt from Developer Only mode (${ignoreList.length}):\n${ignoreList.join(', ')}`
      );
    }

    default:
      return usage();
  }
}
