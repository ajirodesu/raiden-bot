/**
 * warn.js
 * -------
 * Warn group members. Three warnings = automatic kick.
 * Warning data is stored in the thread's `data.warn` array in the DB.
 *
 * Pair with app/events/warnJoin.js to auto-kick banned members on rejoin.
 *
 * Place in: app/commands/warn.js
 */

import moment from 'moment-timezone';

// ── DB helpers ──────────────────────────────────────────────────────────────

async function getWarnList(Threads, threadID) {
  const row  = await Threads.getData(String(threadID));
  return row?.data?.warn || [];
}

async function saveWarnList(Threads, threadID, warnList) {
  const row  = await Threads.getData(String(threadID));
  const data = row?.data || {};
  data.warn  = warnList;
  await Threads.setData(String(threadID), { data });
  global.data.threadData.set(String(threadID), data);
}

function now() {
  return moment.tz(global.config.TIMEZONE || 'Asia/Manila').format('DD/MM/YYYY HH:mm:ss');
}

// ── Command ──────────────────────────────────────────────────────────────────

export const meta = {
  name:        'warn',
  aliases:     ['warning', 'strike'],
  version:     '1.0.0',
  type:        'groupadmin',
  author:      'NTKhang | Converted for Raiden by AjiroDesu',
  description: 'Warn members in the group. Three warnings triggers an automatic kick.',
  category:    'group',
  guide: [
    '@mention [reason]       – warn a tagged member',
    'list                    – list all warned members',
    'listban                 – list members with 3+ warnings',
    'info [@mention|uid]     – view warning history',
    'unwarn @mention|uid [n] – remove warning #n (or last)',
    'unban @mention|uid      – fully pardon a banned member',
    'reset                   – clear all warning data',
  ],
  cooldowns: 5,
};

export async function onStart({ api, event, args, Threads, Users, response, permission, usage }) {
  const { threadID, senderID } = event;
  const tID     = String(threadID);
  const isAdmin = permission >= 1;
  const prefix  = global.data.threadData.get(tID)?.PREFIX || global.config.PREFIX || '/';

  if (!args[0]) return usage();

  const warnList = await getWarnList(Threads, tID);

  switch (args[0]) {

    // ── list ─────────────────────────────────────────────────────────────
    case 'list': {
      if (!warnList.length)
        return response.reply('📋 No members have been warned in this group yet.');

      const lines = await Promise.all(
        warnList.map(async ({ uid, list }) => {
          const name = await Users.getNameUser(uid);
          return `• ${name} (${uid}): ${list.length} warning(s)`;
        })
      );

      return response.reply(
        `📋 Warned members:\n${lines.join('\n')}\n\n` +
        `Use \`${prefix}warn info @mention\` to see details.`
      );
    }

    // ── listban ───────────────────────────────────────────────────────────
    case 'listban': {
      const bannedEntries = warnList.filter(u => u.list.length >= 3);
      if (!bannedEntries.length)
        return response.reply('📋 No members have reached the kick threshold (3 warnings).');

      const lines = await Promise.all(
        bannedEntries.map(async ({ uid }) => {
          const name = await Users.getNameUser(uid);
          return `• ${name} (${uid})`;
        })
      );
      return response.reply(`🚫 Members with 3+ warnings (banned):\n${lines.join('\n')}`);
    }

    // ── info / check ──────────────────────────────────────────────────────
    case 'check':
    case 'info': {
      let uids;
      if (Object.keys(event.mentions || {}).length) uids = Object.keys(event.mentions);
      else if (event.messageReply?.senderID)        uids = [String(event.messageReply.senderID)];
      else if (args[1])                             uids = args.slice(1);
      else                                          uids = [String(senderID)];

      const parts = await Promise.all(uids.map(async uid => {
        if (isNaN(uid)) return null;
        const name  = await Users.getNameUser(uid);
        const entry = warnList.find(u => String(u.uid) === String(uid));
        if (!entry?.list.length) return `👤 ${name} (${uid}): No warnings.`;
        const detail = entry.list.map((w, i) =>
          `  ${i + 1}. ${w.reason} — ${w.dateTime}`
        ).join('\n');
        return `👤 ${name} (${uid}) — ${entry.list.length}/3 warning(s):\n${detail}`;
      }));

      const msg = parts.filter(Boolean).join('\n\n');
      return response.reply(msg || '⚠️ No valid user IDs provided.');
    }

    // ── unban ─────────────────────────────────────────────────────────────
    case 'unban': {
      if (!isAdmin) return response.reply('❌ Only group admins can unban members.');

      const uid = String(
        Object.keys(event.mentions || {})[0]
        || event.messageReply?.senderID
        || args[1]
        || ''
      );
      if (!uid || isNaN(uid)) return response.reply('⚠️ Please tag or enter the user ID to unban.');

      const idx = warnList.findIndex(u => String(u.uid) === uid && u.list.length >= 3);
      if (idx === -1) return response.reply(`⚠️ User ${uid} is not currently banned.`);

      warnList.splice(idx, 1);
      await saveWarnList(Threads, tID, warnList);

      const name = await Users.getNameUser(uid);
      return response.reply(`✅ ${name} (${uid}) has been pardoned and can rejoin the group.`);
    }

    // ── unwarn ────────────────────────────────────────────────────────────
    case 'unwarn': {
      if (!isAdmin) return response.reply('❌ Only group admins can remove warnings.');

      let uid, numArg;
      if (Object.keys(event.mentions || {})[0]) {
        uid    = String(Object.keys(event.mentions)[0]);
        numArg = args[args.length - 1];
      } else if (event.messageReply?.senderID) {
        uid    = String(event.messageReply.senderID);
        numArg = args[1];
      } else {
        uid    = String(args[1] || '');
        numArg = args[2];
      }

      if (!uid || isNaN(uid))
        return response.reply('⚠️ Please tag or enter the user ID to remove a warning from.');

      const entry = warnList.find(u => String(u.uid) === uid);
      if (!entry?.list.length)
        return response.reply(`⚠️ User ${uid} has no warnings on record.`);

      const name = await Users.getNameUser(uid);
      let   num  = parseInt(numArg);
      if (isNaN(num)) num = entry.list.length; // default: remove last

      if (num < 1 || num > entry.list.length)
        return response.reply(`❌ ${name} only has ${entry.list.length} warning(s). Enter a number between 1 and ${entry.list.length}.`);

      entry.list.splice(num - 1, 1);
      if (!entry.list.length)
        warnList.splice(warnList.findIndex(u => String(u.uid) === uid), 1);

      await saveWarnList(Threads, tID, warnList);
      return response.reply(`✅ Warning #${num} removed from ${name} (${uid}).`);
    }

    // ── reset ─────────────────────────────────────────────────────────────
    case 'reset': {
      if (!isAdmin) return response.reply('❌ Only group admins can reset warning data.');
      await saveWarnList(Threads, tID, []);
      return response.reply('✅ All warning data for this group has been reset.');
    }

    // ── warn @mention <reason> ────────────────────────────────────────────
    default: {
      if (!isAdmin) return response.reply('❌ Only group admins can warn members.');

      let uid, reason;
      if (event.messageReply) {
        uid    = String(event.messageReply.senderID);
        reason = args.join(' ').trim() || 'No reason provided.';
      } else if (Object.keys(event.mentions || {})[0]) {
        uid    = String(Object.keys(event.mentions)[0]);
        reason = args.join(' ').replace(event.mentions[uid] || '', '').trim() || 'No reason provided.';
      } else {
        return response.reply('⚠️ Please tag or reply to the message of the user you want to warn.');
      }

      const name  = await Users.getNameUser(uid);
      const dateTime = now();
      let   entry    = warnList.find(u => String(u.uid) === uid);

      if (!entry) {
        entry = { uid, list: [] };
        warnList.push(entry);
      }

      entry.list.push({ reason, dateTime, warnBy: String(senderID) });
      await saveWarnList(Threads, tID, warnList);

      const times = entry.list.length;

      if (times >= 3) {
        await response.reply(
          `⚠️ ${name} has accumulated ${times} warning(s) and has been kicked.\n` +
          `- User ID: ${uid}\n` +
          `- Reason: ${reason}\n` +
          `- Time: ${dateTime}\n\n` +
          `To unban: \`${prefix}warn unban ${uid}\``
        );
        api.removeUserFromGroup(uid, tID, (err) => {
          if (err) response.reply('⚠️ Failed to kick — please ensure I have admin permissions in this group.');
        });
      } else {
        return response.reply(
          `⚠️ ${name} has been warned (${times}/3).\n` +
          `- User ID: ${uid}\n` +
          `- Reason: ${reason}\n` +
          `- Time: ${dateTime}\n` +
          `${3 - times} more warning(s) before kick.`
        );
      }
    }
  }
}
