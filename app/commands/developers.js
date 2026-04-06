import fs from 'fs-extra';

export const meta = {
  name:        'developers',
  aliases:     ['owners'],
  version:     '2.4.0',
  type:        'anyone',
  author:      'Converted and Mod by AjiroDesu',
  description: 'Manage bot developers / owners.',
  category:    'config',
  guide:       ['list | add <userID/@mention> | remove <userID/@mention> | god <userID/@mention>'],
  cooldowns:   5,
};

// ── Shared config helpers ─────────────────────────────────────────────────

function loadConfig() {
  return JSON.parse(fs.readFileSync(global.client.configPath, 'utf-8'));
}

function saveConfig(config) {
  config.ADMINBOT        = [...new Set(global.config.ADMINBOT)];
  global.config.ADMINBOT = config.ADMINBOT;
  fs.writeFileSync(global.client.configPath, JSON.stringify(config, null, 4));
}

async function buildList(Users, list) {
  const lines = await Promise.all(
    list.map(async id => `- ${await Users.getNameUser(id)} (${id})`)
  );
  return lines.join('\n') || 'No developers found.';
}

async function addIDs(ids, list, Users) {
  const added = [];
  for (const id of ids) {
    if (!list.includes(id)) {
      list.push(id);
      added.push(`[ ${id} ] » ${await Users.getNameUser(id)}`);
    }
  }
  return added;
}

function removeIDs(ids, list) {
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

// ── Command ───────────────────────────────────────────────────────────────

export async function onStart({ event, args, Users, permission, response }) {
  const { mentions, senderID } = event;
  const ADMINBOT    = global.config.ADMINBOT || [];
  const masterDevID = String(global.config.DEVELOPER?.ID || '');

  const showList = async () => {
    const lines = await buildList(Users, ADMINBOT);
    return response.reply(`[Developers] Developer/owner list:\n\n${lines}`);
  };

  if (!args[0] || args[0] === 'list' || args[0] === 'all' || args[0] === '-a') {
    return showList();
  }

  const targets = resolveTargets(args, mentions);

  switch (args[0]) {
    case 'add': {
      if (permission < 3) return response.reply('[Developers] You need developer permission to use "add".');
      if (!targets.length) return response.reply('Please provide a valid user ID or mention.');
      const config = loadConfig();
      if (!config.ADMINBOT) config.ADMINBOT = [];
      const added = await addIDs(targets, ADMINBOT, Users);
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
      const added = await addIDs(targets, ADMINBOT, Users);
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
      const removed = removeIDs(targets, ADMINBOT);
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
