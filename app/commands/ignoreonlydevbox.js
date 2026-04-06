/**
 * ignoreonlydevbox.js
 * -------------------
 * Manage per-group commands that are exempt from the "Only Admin Box" restriction.
 * When onlyAdminBox is enabled in a group, commands on this group's list
 * remain usable by all members — effectively whitelisting them per thread.
 *
 * The exempt list is stored in the thread's data column as "ignoreCommandAdminBox".
 * Enforcement is handled in core/handle/handleCommand.js.
 *
 * Subcommands:
 *   add <commandName>  – exempt a command for this group
 *   del <commandName>  – remove a command from this group's exempt list
 *   list               – view this group's current exempt list
 *
 * Place in: app/commands/ignoreonlydevbox.js
 */

export const meta = {
  name:        'ignoreonlydevbox',
  aliases:     ['ignoredevboxonly', 'ignoreboxonly', 'adminboxignore'],
  version:     '1.0.0',
  type:        'groupadmin',
  author:      'NTKhang | Converted for Raiden by AjiroDesu',
  description: 'Manage commands exempt from Only Admin Box mode for this group.',
  category:    'group',
  guide: [
    'add <commandName>  – let all members use this command even when Only Admin Box is ON',
    'del <commandName>  – remove a command from this group\'s exempt list',
    'list               – view all currently exempted commands for this group',
  ],
  cooldowns: 5,
};

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getThreadData(Threads, threadID) {
  const row = await Threads.getData(String(threadID));
  return row?.data || {};
}

async function saveThreadData(Threads, threadID, data) {
  await Threads.setData(String(threadID), { data });
  global.data.threadData.set(String(threadID), data);
}

// ── Command ───────────────────────────────────────────────────────────────────

export async function onStart({ args, event, Threads, response, usage }) {
  const { threadID } = event;
  const tID          = String(threadID);
  const sub          = args[0]?.toLowerCase();

  switch (sub) {

    // ── add ──────────────────────────────────────────────────────────────────
    case 'add': {
      const cmdName = args[1]?.toLowerCase();
      if (!cmdName)
        return response.reply('⚠️ Please enter the command name you want to add to the exempt list.');

      const command = global.client.commands.get(cmdName);
      if (!command)
        return response.reply(`❌ Command "${cmdName}" not found in the bot's command list.`);

      const tData      = await getThreadData(Threads, tID);
      const ignoreList = tData.ignoreCommandAdminBox || [];

      if (ignoreList.includes(cmdName))
        return response.reply(`❌ "${cmdName}" is already in this group's exempt list.`);

      ignoreList.push(cmdName);
      tData.ignoreCommandAdminBox = ignoreList;
      await saveThreadData(Threads, tID, tData);

      return response.reply(
        `✅ Added "${cmdName}" to this group's Only Admin Box exempt list.\n` +
        `All members can now use this command even when Only Admin Box is ON.`
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

      const tData      = await getThreadData(Threads, tID);
      const ignoreList = tData.ignoreCommandAdminBox || [];

      if (!ignoreList.includes(cmdName))
        return response.reply(`❌ "${cmdName}" is not in this group's exempt list.`);

      ignoreList.splice(ignoreList.indexOf(cmdName), 1);
      tData.ignoreCommandAdminBox = ignoreList;
      await saveThreadData(Threads, tID, tData);

      return response.reply(
        `✅ Removed "${cmdName}" from this group's Only Admin Box exempt list.\n` +
        `It is now restricted when Only Admin Box is ON.`
      );
    }

    // ── list ─────────────────────────────────────────────────────────────────
    case 'list': {
      const tData      = await getThreadData(Threads, tID);
      const ignoreList = tData.ignoreCommandAdminBox || [];

      if (!ignoreList.length)
        return response.reply(
          '📑 Only Admin Box exempt list for this group is empty.\n' +
          'No commands are currently whitelisted.'
        );

      return response.reply(
        `📑 Commands exempt from Only Admin Box in this group (${ignoreList.length}):\n${ignoreList.join(', ')}`
      );
    }

    default:
      return usage();
  }
}
