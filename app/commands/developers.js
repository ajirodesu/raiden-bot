/**
 * developers.js
 * -------------
 * Manage bot developers / adminbot users and elevate entire group chats to
 * developer-level access.
 *
 * User sub-commands  (manage individuals in config.json › ADMINBOT):
 *   list                           – show all developers
 *   add    <userID/@mention>       – add a developer (requires dev permission)
 *   remove <userID/@mention>       – remove a developer (requires dev permission)
 *   god    <userID/@mention>       – force-add without permission check (master dev only)
 *
 * Thread sub-commands  (manage group-level developer access via DB):
 *   thread list                    – list all threads with developer access
 *   thread add    [tid]            – grant developer access to a thread (defaults to current)
 *   thread remove [tid]            – revoke developer access from a thread
 *
 * Place in: app/commands/developers.js
 */

import fs from 'fs-extra';

export const meta = {
  name:        'developers',
  aliases:     ['owners', 'devs'],
  version:     '3.0.0',
  type:        'anyone',
  author:      'Converted and Mod by AjiroDesu',
  description: 'Manage bot developers / owners, including group-level developer access.',
  category:    'config',
  guide: [
    'list                          – list all individual developers',
    'add <userID/@mention>         – add a developer',
    'remove <userID/@mention>      – remove a developer',
    'god <userID/@mention>         – force-add (master dev only)',
    'thread list                   – list threads with developer access',
    'thread add [tid]              – grant developer access to a thread',
    'thread remove [tid]           – revoke developer access from a thread',
  ],
  cooldowns: 5,
};

// ── Config helpers (individual users) ────────────────────────────────────

function loadConfig() {
  return JSON.parse(fs.readFileSync(global.client.configPath, 'utf-8'));
}

function saveConfig(config) {
  config.ADMINBOT        = [...new Set(global.config.ADMINBOT)];
  global.config.ADMINBOT = config.ADMINBOT;
  fs.writeFileSync(global.client.configPath, JSON.stringify(config, null, 4));
}

async function buildUserList(Users, list) {
  const lines = await Promise.all(
    list.map(async id => `- ${await Users.getNameUser(id)} (${id})`)
  );
  return lines.join('\n') || 'No developers found.';
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

async function setThreadDevAccess(Threads, tid, enable) {
  const row     = await Threads.getData(tid);
  const newData = { ...(row?.data || {}) };

  if (enable) {
    newData.threadAdminBot = true;
    delete newData.threadPremium; // dev supersedes premium
  } else {
    delete newData.threadAdminBot;
  }

  await Threads.setData(tid, { data: newData });

  // Sync in-memory immediately — no restart required
  if (enable) {
    global.data.threadAdminBot.add(tid);
    global.data.threadPremium.delete(tid);
  } else {
    global.data.threadAdminBot.delete(tid);
  }
}

// ── Command ───────────────────────────────────────────────────────────────

export async function onStart({ event, args, Users, Threads, permission, response }) {
  const { mentions, senderID, threadID } = event;
  const ADMINBOT    = global.config.ADMINBOT || [];
  const masterDevID = String(global.config.DEVELOPER?.ID || '');

  // ── thread sub-commands ───────────────────────────────────────────────
  if ((args[0] || '').toLowerCase() === 'thread') {
    const threadSub = (args[1] || '').toLowerCase();

    // thread list
    if (!threadSub || threadSub === 'list' || threadSub === '-l') {
      const devThreads = [...global.data.threadAdminBot];
      if (!devThreads.length)
        return response.reply('[Developers] No threads currently have developer access.');

      const lines = await Promise.all(
        devThreads.map(async tid => `- ${await getThreadName(Threads, tid)} (${tid})`)
      );
      return response.reply(`[Developers] Threads with developer access:\n\n${lines.join('\n')}`);
    }

    // thread add / remove — require developer permission
    if (permission < 3)
      return response.reply('[Developers] You need developer permission to manage thread access.');

    const tid = (args[2] && !isNaN(args[2])) ? args[2] : String(threadID);

    if (threadSub === 'add' || threadSub === 'grant') {
      if (global.data.threadAdminBot.has(tid)) {
        const name = await getThreadName(Threads, tid);
        return response.reply(`[Developers] ${name} (${tid}) already has developer access.`);
      }
      await setThreadDevAccess(Threads, tid, true);
      const name = await getThreadName(Threads, tid);
      return response.reply(
        `🟢 [Developers] Granted developer access to ${name} (${tid}).\n` +
        `All members in that thread now operate at developer level.`
      );
    }

    if (threadSub === 'remove' || threadSub === 'rm' || threadSub === 'revoke') {
      if (!global.data.threadAdminBot.has(tid)) {
        const name = await getThreadName(Threads, tid);
        return response.reply(`[Developers] ${name} (${tid}) does not have developer access.`);
      }
      await setThreadDevAccess(Threads, tid, false);
      const name = await getThreadName(Threads, tid);
      return response.reply(
        `🔴 [Developers] Revoked developer access from ${name} (${tid}).\n` +
        `Members of that thread now operate at their normal permission level.`
      );
    }

    return response.reply('[Developers] Unknown thread sub-command. Use: list | add [tid] | remove [tid]');
  }

  // ── user list (default) ───────────────────────────────────────────────
  const showList = async () => {
    const lines = await buildUserList(Users, ADMINBOT);
    return response.reply(`[Developers] Developer/owner list:\n\n${lines}`);
  };

  if (!args[0] || args[0] === 'list' || args[0] === 'all' || args[0] === '-a')
    return showList();

  const targets = resolveTargets(args, mentions);

  switch (args[0]) {
    case 'add': {
      if (permission < 3) return response.reply('[Developers] You need developer permission to use "add".');
      if (!targets.length) return response.reply('Please provide a valid user ID or mention.');
      const config = loadConfig();
      if (!config.ADMINBOT) config.ADMINBOT = [];
      const added = await addUserIDs(targets, ADMINBOT, Users);
      saveConfig(config);
      return response.reply(added.length
        ? `🟢 [Developers] Added ${added.length} developer(s):\n\n${added.join('\n')}`
        : '🟢 [Developers] No new developers added (already in list).'
      );
    }

    case 'god': {
      if (!masterDevID || senderID !== masterDevID)
        return response.reply('[Developers] Only the master developer can use "god".');
      if (!targets.length) return response.reply('Please provide a valid user ID or mention.');
      const config = loadConfig();
      if (!config.ADMINBOT) config.ADMINBOT = [];
      const added = await addUserIDs(targets, ADMINBOT, Users);
      saveConfig(config);
      return response.reply(added.length
        ? `🟢 [Developers] (God) Force added ${added.length} developer(s):\n\n${added.join('\n')}`
        : '🟢 [Developers] No new developers added (already in list).'
      );
    }

    case 'remove':
    case 'rm':
    case 'delete': {
      if (permission < 3) return response.reply('[Developers] You need developer permission to use "remove".');
      if (!targets.length) return response.reply('Please provide a valid user ID or mention.');
      const config  = loadConfig();
      const removed = removeUserIDs(targets, ADMINBOT);
      if (removed.length) saveConfig(config);
      const names = await Promise.all(removed.map(id => Users.getNameUser(id).then(n => `[ ${id} ] » ${n}`)));
      return response.reply(names.length
        ? `🔴 [Developers] Removed ${names.length} developer(s):\n\n${names.join('\n')}`
        : '🟢 [Developers] No developers removed (not found in list).'
      );
    }

    default:
      return showList();
  }
}
