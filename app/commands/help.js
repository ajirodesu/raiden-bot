export const meta = {
  name: "help",
  version: "1.0.3",
  type: "anyone", // anyone | groupadmin | premium | developer
  author: "AjiroDesu",
  description: "Beginner's Guide — lists all commands or shows details about a specific command.",
  category: "system",
  guide: ["[command name]"],
  cooldowns: 5,
  autoUnsend: false,
  delayUnsend: 20
};

// ── Helpers ────────────────────────────────────────────────────────────────
function getPermissionLabel(type) {
  switch (type) {
    case "groupadmin": return "Group Administrator";
    case "developer":  return "Bot Administrator";
    case "premium":    return "Premium User";
    default:           return "Regular User";
  }
}

function buildModuleInfo(command, prefix) {
  const permission = getPermissionLabel(command.meta.type);
  const usage = command.meta.guide?.join(" ") || "";
  const usageLine = usage ? ` ${usage}` : "";

  return `COMMAND INFORMATION

Name        : ${command.meta.name}
Description : ${command.meta.description}
Usage       : ${prefix}${command.meta.name}${usageLine}
Category    : ${command.meta.category.toUpperCase()}
Cooldown    : ${command.meta.cooldowns} second(s)
Permission  : ${permission}
Version     : ${command.meta.version}
Author      : ${command.meta.author}`;
}

// ── Event handler (inline help trigger) ───────────────────────────────────
export async function onEvent({ api, event }) {
  const { commands } = global.client;
  const { threadID, messageID, body } = event;

  if (!body || typeof body === "undefined" || body.indexOf("help") !== 0) return;

  const splitBody = body.slice(body.indexOf("help")).trim().split(/\s+/);
  if (splitBody.length === 1 || !commands.has(splitBody[1].toLowerCase())) return;

  const threadSetting = global.data.threadData.get(parseInt(threadID)) || {};
  const command       = commands.get(splitBody[1].toLowerCase());
  const prefix        = threadSetting.hasOwnProperty("PREFIX") ? threadSetting.PREFIX : global.config.PREFIX;

  return api.sendMessage(buildModuleInfo(command, prefix), threadID, messageID);
}

// ── Main command ───────────────────────────────────────────────────────────
export async function onStart({ api, event, args, response }) {
  const { commands }        = global.client;
  const { threadID, messageID } = event;

  const threadSetting       = global.data.threadData.get(parseInt(threadID)) || {};
  const prefix              = threadSetting.hasOwnProperty("PREFIX") ? threadSetting.PREFIX : global.config.PREFIX;
  const botName             = (global.config.BOTNAME || "BOT").toUpperCase();

  const targetArg = (args[0] || "").toLowerCase();
  const command   = commands.get(targetArg);

  // ── Specific command info ────────────────────────────────────────────
  if (command) {
    return response.reply(buildModuleInfo(command, prefix));
  }

  // ── Tree / all view ─────────────────────────────────────────────────
  if (targetArg === "all") {
    const grouped = {};
    for (const [, value] of commands) {
      const cat = value.meta.category || "other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(value.meta.name);
    }

    let msg = `${botName} COMMAND TREE\n\n`;

    for (const [cat, names] of Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]))) {
      msg += `📂 ${cat.toUpperCase()}\n`;
      for (const name of names.sort()) {
        msg += `  • ${prefix}${name}\n`;
      }
      msg += `\n`;
    }
    msg += `Total Commands: ${commands.size}`;

    return response.reply(msg);
  }

  // ── Paginated command list ───────────────────────────────────────────
  const perPage    = 8;
  const page       = parseInt(args[0]) || 1;
  const arrayInfo  = [];

  for (const [, value] of commands) {
    arrayInfo.push({
      name:        value.meta.name,
      description: value.meta.description || "No description provided."
    });
  }

  arrayInfo.sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.ceil(arrayInfo.length / perPage);
  const safePage   = Math.min(Math.max(page, 1), totalPages || 1);
  const start      = perPage * safePage - perPage;
  const slice      = arrayInfo.slice(start, start + perPage);

  let msg = `${botName} COMMAND CENTER\n\n`;

  for (const { name, description } of slice) {
    msg += `▫️${prefix}${name}\n`;
    msg += `   ↳ ${description}\n\n`;
  }
  msg += `Page ${safePage}/${totalPages} | ${commands.size} Commands\n`
  msg += `Type ${prefix}help <command> for detailed information
${prefix}help all for complete tree view
${prefix}help <page number> to navigate pages`;

  return response.reply(msg);
}