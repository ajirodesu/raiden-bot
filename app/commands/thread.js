/**
 * thread.js
 * ---------
 * Manage group threads in the bot system: find by name, ban, unban, or view info.
 *
 * Subcommands (developer-only unless noted):
 *   find <n>           – search all known threads by name
 *   find -j <n>        – search only threads currently tracked (approx. joined)
 *   ban [tid] <reason> – ban a thread (omit tid to target current group)
 *   unban [tid]        – unban a thread (omit tid for current group)
 *   info [tid]         – show thread info (available to all users)
 *
 * Place in: app/commands/thread.js
 */

export const meta = {
  name:        'thread',
  aliases:     ['threads', 'managethread'],
  version:     '1.0.0',
  type:        'anyone',          // Per-subcommand permission checks below
  author:      'NTKhang | Converted for Raiden by AjiroDesu',
  description: 'Manage group threads in the bot system — find, ban, unban, or view info.',
  category:    'developer',
  guide: [
    'find <n>           – search threads by name (developer only)',
    'find -j <n>        – search only tracked threads (developer only)',
    'ban [tid] <reason> – ban a thread; omit tid for current group (developer only)',
    'unban [tid]        – unban a thread; omit tid for current group (developer only)',
    'info [tid]         – show thread info; omit tid for current group',
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

export async function onStart({ args, event, Threads, response, permission, usage }) {
  const sub      = args[0]?.toLowerCase();
  const threadID = String(event.threadID);

  switch (sub) {

    // ── find ─────────────────────────────────────────────────────────────────
    case 'find':
    case 'search':
    case '-f':
    case '-s': {
      if (permission < 3)
        return response.reply("❌ You don't have permission to use this feature.");

      let allThreads = await Threads.getAll();
      let keyword    = args.slice(1).join(' ');

      // -j / -join: only threads tracked in global.data (approx. currently joined)
      if (['-j', '-join', '--joined'].includes(args[1])) {
        const tracked = new Set(global.data.allThreadID);
        allThreads    = allThreads.filter(t => tracked.has(String(t.threadID)));
        keyword       = args.slice(2).join(' ');
      }

      const results = allThreads.filter(t =>
        String(t.threadID).length > 15 &&
        (t.threadInfo?.threadName || '').toLowerCase().includes(keyword.toLowerCase())
      );

      if (!results.length)
        return response.reply(`❌ No thread found matching: "${keyword}"`);

      const list = results
        .map(t =>
          `╭ Name: ${t.threadInfo?.threadName || 'Unknown'}\n╰ ID: ${t.threadID}`
        )
        .join('\n\n');

      return response.reply(
        `🔎 Found ${results.length} thread(s) matching "${keyword}":\n\n${list}`
      );
    }

    // ── ban ──────────────────────────────────────────────────────────────────
    case 'ban':
    case '-b': {
      if (permission < 3)
        return response.reply("❌ You don't have permission to use this feature.");

      let tid, reason;
      if (args[1] && !isNaN(args[1])) {
        tid    = args[1];
        reason = args.slice(2).join(' ').trim();
      } else {
        tid    = threadID;
        reason = args.slice(1).join(' ').trim();
      }

      if (!tid)   return usage();
      if (!reason) return response.reply('⚠️ Please provide a reason for the ban.');
      reason = reason.replace(/\s+/g, ' ');

      const threadData = await Threads.getData(tid);
      const name       = threadData?.threadInfo?.threadName || 'Unknown Thread';

      if (global.data.threadBanned.has(tid)) {
        const { reason: r, dateAdded } = global.data.threadBanned.get(tid);
        return response.reply(
          `❌ Thread [${tid} | ${name}] is already banned.\n» Reason: ${r}\n» Date: ${dateAdded}`
        );
      }

      const dateAdded = nowFormatted();
      await Threads.setData(tid, {
        data: { ...(threadData?.data || {}), banned: true, reason, dateAdded },
      });
      global.data.threadBanned.set(tid, { reason, dateAdded });

      return response.reply(
        `✅ Banned thread [${tid} | ${name}].\n» Reason: ${reason}\n» Date: ${dateAdded}`
      );
    }

    // ── unban ─────────────────────────────────────────────────────────────────
    case 'unban':
    case '-u': {
      if (permission < 3)
        return response.reply("❌ You don't have permission to use this feature.");

      const tid = (args[1] && !isNaN(args[1])) ? args[1] : threadID;
      if (!tid) return usage();

      const threadData = await Threads.getData(tid);
      const name       = threadData?.threadInfo?.threadName || 'Unknown Thread';

      if (!global.data.threadBanned.has(tid))
        return response.reply(`❌ Thread [${tid} | ${name}] is not currently banned.`);

      const newData = { ...(threadData?.data || {}) };
      delete newData.banned;
      delete newData.reason;
      delete newData.dateAdded;

      await Threads.setData(tid, { data: newData });
      global.data.threadBanned.delete(tid);

      // Sync in-memory thread data cache
      const cached = global.data.threadData.get(tid) || {};
      delete cached.banned;
      delete cached.reason;
      delete cached.dateAdded;
      global.data.threadData.set(tid, cached);

      return response.reply(
        `✅ Unbanned thread [${tid} | ${name}]. The bot can now be used there.`
      );
    }

    // ── info ──────────────────────────────────────────────────────────────────
    case 'info':
    case '-i': {
      const tid = (args[1] && !isNaN(args[1])) ? args[1] : threadID;
      if (!tid) return usage();

      const threadData = await Threads.getData(tid);
      if (!threadData)
        return response.reply(`❌ No data found for thread ID: ${tid}`);

      const tInfo  = threadData.threadInfo || {};
      const tData  = threadData.data || {};
      const banned = global.data.threadBanned.has(tid);

      let msg =
        `» Thread ID: ${tid}\n` +
        `» Name: ${tInfo.threadName || 'Unknown'}\n` +
        `» Admins: ${(tInfo.adminIDs || []).length} admin(s)\n` +
        `» Only Admin Box: ${tData.onlyAdminBox ? '🔒 ON' : '🔓 OFF'}\n` +
        `» Banned: ${banned ? '🔴 Yes' : '🟢 No'}`;

      if (banned) {
        const { reason, dateAdded } = global.data.threadBanned.get(tid);
        msg += `\n  › Reason: ${reason}\n  › Date: ${dateAdded}`;
      }

      return response.reply(msg);
    }

    default:
      return usage();
  }
}
