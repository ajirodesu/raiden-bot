/**
 * user.js
 * -------
 * Manage users in the bot system: find by name, ban, or unban.
 *
 * Subcommands:
 *   find <name>                       – search for a user by name
 *   ban <uid | @tag | reply> <reason> – ban a user from using the bot
 *   unban <uid | @tag | reply>        – unban a user
 *
 * Place in: app/commands/user.js
 */

export const meta = {
  name:        'user',
  aliases:     ['users', 'manageuser'],
  version:     '1.0.0',
  type:        'developer',
  author:      'NTKhang | Converted for Raiden by AjiroDesu',
  description: 'Manage users in the bot system — find, ban, or unban.',
  category:    'developer',
  guide: [
    'find <name>                        – search for a user by name',
    'ban <uid | @tag | reply> <reason>  – ban a user from using the bot',
    'unban <uid | @tag | reply>         – unban a user',
  ],
  cooldowns: 5,
};

// ── Helper ────────────────────────────────────────────────────────────────────

function nowFormatted() {
  const tz = global.config?.TIMEZONE || 'UTC';
  return new Date().toLocaleString('en-US', {
    timeZone:  tz,
    month:     '2-digit',
    day:       '2-digit',
    year:      'numeric',
    hour:      '2-digit',
    minute:    '2-digit',
    second:    '2-digit',
    hour12:    false,
  });
}

// ── Command ───────────────────────────────────────────────────────────────────

export async function onStart({ args, event, Users, response, usage }) {
  const sub = args[0]?.toLowerCase();

  switch (sub) {

    // ── find ─────────────────────────────────────────────────────────────────
    case 'find':
    case '-f':
    case 'search':
    case '-s': {
      const keyword = args.slice(1).join(' ');
      if (!keyword) return usage();

      const allUsers = await Users.getAll();
      const matches  = allUsers.filter(u =>
        (u.name || '').toLowerCase().includes(keyword.toLowerCase())
      );

      if (!matches.length)
        return response.reply(`❌ No user found matching: "${keyword}"`);

      const list = matches
        .map(u => `╭ Name: ${u.name || 'Unknown'}\n╰ ID: ${u.userID}`)
        .join('\n\n');

      return response.reply(
        `🔎 Found ${matches.length} user(s) matching "${keyword}":\n\n${list}`
      );
    }

    // ── ban ──────────────────────────────────────────────────────────────────
    case 'ban':
    case '-b': {
      let uid, reason;

      if (event.messageReply) {
        uid    = String(event.messageReply.senderID);
        reason = args.slice(1).join(' ').trim();
      } else if (Object.keys(event.mentions || {}).length > 0) {
        const mentions = event.mentions;
        uid    = Object.keys(mentions)[0];
        reason = args.slice(1).join(' ').replace(mentions[uid], '').trim();
      } else if (args[1]) {
        uid    = args[1];
        reason = args.slice(2).join(' ').trim();
      } else {
        return usage();
      }

      if (!uid)
        return response.reply('⚠️ Please provide a user ID, @tag, or reply to a message.');
      if (!reason)
        return response.reply('⚠️ Please provide a reason for the ban.');

      reason = reason.replace(/\s+/g, ' ');

      const userData = await Users.getData(uid);
      const name     = userData?.name || 'Unknown User';

      if (global.data.userBanned.has(uid)) {
        const { reason: r, dateAdded } = global.data.userBanned.get(uid);
        return response.reply(
          `❌ User [${uid} | ${name}] is already banned.\n» Reason: ${r}\n» Date: ${dateAdded}`
        );
      }

      const dateAdded = nowFormatted();
      await Users.setData(uid, {
        data: { ...(userData?.data || {}), banned: true, reason, dateAdded },
      });
      global.data.userBanned.set(uid, { reason, dateAdded });

      return response.reply(
        `✅ Banned user [${uid} | ${name}].\n» Reason: ${reason}\n» Date: ${dateAdded}`
      );
    }

    // ── unban ─────────────────────────────────────────────────────────────────
    case 'unban':
    case '-u': {
      let uid;

      if (event.messageReply) {
        uid = String(event.messageReply.senderID);
      } else if (Object.keys(event.mentions || {}).length > 0) {
        uid = Object.keys(event.mentions)[0];
      } else if (args[1]) {
        uid = args[1];
      } else {
        return usage();
      }

      if (!uid)
        return response.reply('⚠️ Please provide a user ID, @tag, or reply to a message.');

      const userData = await Users.getData(uid);
      const name     = userData?.name || 'Unknown User';

      if (!global.data.userBanned.has(uid))
        return response.reply(`❌ User [${uid} | ${name}] is not currently banned.`);

      const newData = { ...(userData?.data || {}) };
      delete newData.banned;
      delete newData.reason;
      delete newData.dateAdded;

      await Users.setData(uid, { data: newData });
      global.data.userBanned.delete(uid);

      return response.reply(
        `✅ Unbanned user [${uid} | ${name}]. They can use the bot again.`
      );
    }

    default:
      return usage();
  }
}
