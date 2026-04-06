import fs from 'fs-extra';

export const meta = {
  name:        'premium',
  aliases:     ['vip'],
  version:     '1.2.0',
  type:        'anyone',
  author:      'Converted by AjiroDesu',
  description: 'Manage premium users.',
  category:    'config',
  guide:       ['list | add <userID/@mention> | remove <userID/@mention> | god <userID/@mention>'],
  cooldowns:   5,
};

// ── Shared config helpers ─────────────────────────────────────────────────

function loadConfig() {
  return JSON.parse(fs.readFileSync(global.client.configPath, 'utf-8'));
}

function saveConfig(config) {
  config.PREMIUM        = [...new Set(global.config.PREMIUM)];
  global.config.PREMIUM = config.PREMIUM;
  fs.writeFileSync(global.client.configPath, JSON.stringify(config, null, 4));
}

async function buildList(Users, list) {
  const lines = await Promise.all(
    list.map(async id => `- ${await Users.getNameUser(id)} (${id})`)
  );
  return lines.join('\n') || 'No premium users found.';
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

export async function onStart({ event, args, Users, response }) {
  const { mentions, senderID } = event;
  const PREMIUM     = global.config.PREMIUM     || [];
  const ADMINBOT    = global.config.ADMINBOT    || [];
  const masterDevID = String(global.config.DEVELOPER?.ID || '');

  const showList = async () => {
    const lines = await buildList(Users, PREMIUM);
    return response.reply(`[Premium] Premium user list:\n\n${lines}`);
  };

  if (!args[0] || args[0] === 'list' || args[0] === 'all' || args[0] === '-a') {
    return showList();
  }

  const targets = resolveTargets(args, mentions);

  switch (args[0]) {
    case 'add': {
      if (!ADMINBOT.includes(senderID)) return response.reply('[Premium] Only bot admins can add premium users.');
      if (!targets.length) return response.reply('Please provide a valid user ID or mention.');
      const config = loadConfig();
      if (!config.PREMIUM) config.PREMIUM = [];
      const added = await addIDs(targets, PREMIUM, Users);
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
      const added = await addIDs(targets, PREMIUM, Users);
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
      const removed = removeIDs(targets, PREMIUM);
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
