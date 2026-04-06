/**
 * premium.js
 * ----------
 * Manage premium users and elevate entire group chats to premium-level access.
 *
 * User sub-commands  (manage individuals in config.json › PREMIUM):
 *   list                           – show all premium users
 *   add    <userID/@mention>       – add a premium user (requires developer permission)
 *   remove <userID/@mention>       – remove a premium user (requires developer permission)
 *   god    <userID/@mention>       – force-add without permission check (master dev only)
 *
 * Thread sub-commands  (manage group-level premium access via DB):
 *   thread list                    – list all threads with premium access
 *   thread add    [tid]            – grant premium access to a thread (defaults to current)
 *   thread remove [tid]            – revoke premium access from a thread
 *
 * Place in: app/commands/premium.js
 */

import fs from 'fs-extra';

export const meta = {
  name:        'premium',
  aliases:     ['vip'],
  version:     '2.0.0',
  type:        'anyone',
  author:      'Converted by AjiroDesu',
  description: 'Manage premium users, including group-level premium access.',
  category:    'config',
  guide: [
    'list                          – list all premium users',
    'add <userID/@mention>         – add a premium user',
    'remove <userID/@mention>      – remove a premium user',
    'god <userID/@mention>         – force-add (master dev only)',
    'thread list                   – list threads with premium access',
    'thread add [tid]              – grant premium access to a thread',
    'thread remove [tid]           – revoke premium access from a thread',
  ],
  cooldowns: 5,
};

// ── Config helpers (individual users) ────────────────────────────────────

function loadConfig() {
  return JSON.parse(fs.readFileSync(global.client.configPath, 'utf-8'));
}

function saveConfig(config) {
  config.PREMIUM        = [...new Set(global.config.PREMIUM)];
  global.config.PREMIUM = config.PREMIUM;
  fs.writeFileSync(global.client.configPath, JSON.stringify(config, null, 4));
}

async function buildUserList(Users, list) {
  const lines = await Promise.all(
    list.map(async id => `- ${await Users.getNameUser(id)} (${id})`)
  );
  return lines.join('\n') || 'No premium users found.';
}

async function addUserIDs(ids, list, Users) {
  const added = [];
  for (const id of ids) {
    if (!list.includes(id)) {
      list.push(id);
      added.push(`[ ${id} ] » ${await Users.getNameUser(id)}`);
    }
  }
  return added;
}

function removeUserIDs(ids, list) {
  const removed = [];
  for (const id of ids) {
    const i = list.indexOf(id);
    if (i !== -1) { list.splice(i, 1); removed.push(id); }
  }
  return removed;
}

function resolveTargets(args, mentions) {
  const mentionIDs = Object.keys(mentions || {});
  if (mentionIDs.length) return mentionIDs;
  const id = args[1];
  return id && !isNaN(id) ? [id] : [];
}

// ── Thread helpers ────────────────────────────────────────────────────────

async function getThreadName(Threads, tid) {
  try {
    const row = await Threads.getData(tid);
    return row?.threadInfo?.threadName || `Thread ${tid}`;
  } catch {
    return `Thread ${tid}`;
  }
}

async function setThreadPremiumAccess(Threads, tid, enable) {
  const row     = await Threads.getData(tid);
  const newData = { ...(row?.data || {}) };

  if (enable) {
    newData.threadPremium = true;
  } else {
    delete newData.threadPremium;
  }

  await Threads.setData(tid, { data: newData });

  // Sync in-memory immediately — no restart required
  if (enable) {
    global.data.threadPremium.add(tid);
  } else {
    global.data.threadPremium.delete(tid);
  }
}

// ── Command ───────────────────────────────────────────────────────────────

export async function onStart({ event, args, Users, Threads, permission, response }) {
  const { mentions, senderID, threadID } = event;
  const PREMIUM     = global.config.PREMIUM  || [];
  const ADMINBOT    = global.config.ADMINBOT || [];
  const masterDevID = String(global.config.DEVELOPER?.ID || '');

  // ── thread sub-commands ───────────────────────────────────────────────
  if ((args[0] || '').toLowerCase() === 'thread') {
    const threadSub = (args[1] || '').toLowerCase();

    // thread list
    if (!threadSub || threadSub === 'list' || threadSub === '-l') {
      const premiumThreads = [...global.data.threadPremium];
      if (!premiumThreads.length)
        return response.reply('[Premium] No threads currently have premium access.');

      const lines = await Promise.all(
        premiumThreads.map(async tid => `- ${await getThreadName(Threads, tid)} (${tid})`)
      );
      return response.reply(`[Premium] Threads with premium access:\n\n${lines.join('\n')}`);
    }

    // thread add / remove — require developer permission
    if (permission < 3)
      return response.reply('[Premium] You need developer permission to manage thread access.');

    const tid = (args[2] && !isNaN(args[2])) ? args[2] : String(threadID);

    if (threadSub === 'add' || threadSub === 'grant') {
      // Block if thread already has developer-level (which supersedes premium)
      if (global.data.threadAdminBot.has(tid)) {
        const name = await getThreadName(Threads, tid);
        return response.reply(`[Premium] ${name} (${tid}) already has developer access, which includes premium.`);
      }
      if (global.data.threadPremium.has(tid)) {
        const name = await getThreadName(Threads, tid);
        return response.reply(`[Premium] ${name} (${tid}) already has premium access.`);
      }
      await setThreadPremiumAccess(Threads, tid, true);
      const name = await getThreadName(Threads, tid);
      return response.reply(
        `🟢 [Premium] Granted premium access to ${name} (${tid}).\n` +
        `All members in that thread now operate at premium level.`
      );
    }

    if (threadSub === 'remove' || threadSub === 'rm' || threadSub === 'revoke') {
      if (!global.data.threadPremium.has(tid)) {
        const name = await getThreadName(Threads, tid);
        return response.reply(`[Premium] ${name} (${tid}) does not have premium access.`);
      }
      await setThreadPremiumAccess(Threads, tid, false);
      const name = await getThreadName(Threads, tid);
      return response.reply(
        `🔴 [Premium] Revoked premium access from ${name} (${tid}).\n` +
        `Members of that thread now operate at their normal permission level.`
      );
    }

    return response.reply('[Premium] Unknown thread sub-command. Use: list | add [tid] | remove [tid]');
  }

  // ── user list (default) ───────────────────────────────────────────────
  const showList = async () => {
    const lines = await buildUserList(Users, PREMIUM);
    return response.reply(`[Premium] Premium user list:\n\n${lines}`);
  };

  if (!args[0] || args[0] === 'list' || args[0] === 'all' || args[0] === '-a')
    return showList();

  const targets = resolveTargets(args, mentions);

  switch (args[0]) {
    case 'add': {
      if (!ADMINBOT.includes(senderID)) return response.reply('[Premium] Only bot admins can add premium users.');
      if (!targets.length) return response.reply('Please provide a valid user ID or mention.');
      const config = loadConfig();
      if (!config.PREMIUM) config.PREMIUM = [];
      const added = await addUserIDs(targets, PREMIUM, Users);
      saveConfig(config);
      return response.reply(added.length
        ? `🟢 [Premium] Added ${added.length} premium user(s):\n\n${added.join('\n')}`
        : '🟢 [Premium] No new premium users added (already in list).'
      );
    }

    case 'god': {
      if (!masterDevID || senderID !== masterDevID)
        return response.reply('[Premium] Only the master developer can use "god".');
      if (!targets.length) return response.reply('Please provide a valid user ID or mention.');
      const config = loadConfig();
      if (!config.PREMIUM) config.PREMIUM = [];
      const added = await addUserIDs(targets, PREMIUM, Users);
      saveConfig(config);
      return response.reply(added.length
        ? `🟢 [Premium] (God) Force added ${added.length} premium user(s):\n\n${added.join('\n')}`
        : '🟢 [Premium] No new premium users added (already in list).'
      );
    }

    case 'remove':
    case 'rm':
    case 'delete': {
      if (!ADMINBOT.includes(senderID)) return response.reply('[Premium] Only bot admins can remove premium users.');
      if (!targets.length) return response.reply('Please provide a valid user ID or mention.');
      const config  = loadConfig();
      const removed = removeUserIDs(targets, PREMIUM);
      if (removed.length) saveConfig(config);
      const names = await Promise.all(removed.map(id => Users.getNameUser(id).then(n => `[ ${id} ] » ${n}`)));
      return response.reply(names.length
        ? `🔴 [Premium] Removed ${names.length} premium user(s):\n\n${names.join('\n')}`
        : '🟢 [Premium] No premium users removed (not found in list).'
      );
    }

    default:
      return showList();
  }
}
