export const meta = {
  name: "help",
  version: "1.0.10",
  type: "anyone",
  author: "AjiroDesu",
  description: "Beginner's Guide — lists all commands or shows details about a specific command.",
  category: "system",
  guide: ["[command name]", "all", "<page number>"],
  cooldowns: 5,
  autoUnsend: false,
  delayUnsend: 20
};

// ── PURE DYNAMIC EMOJI API (EmojisWorld - 100% API only) ───────────────────
// Endpoint: https://api.emojisworld.fr/v1/search?q=KEYWORD&limit=1
// Completely API-driven. No fallbacks, no overrides, no pools.
// Supports ANY meta.category keyword (system, fun, ai, xp, custom123, etc.)
// Uses meta.name + meta.category for command details (maximum accuracy)
// Uses meta.category only for tree view (consistent per category)

const EMOJI_API_BASE = "https://api.emojisworld.fr/v1/search";

let emojiCache = new Map(); // Global cache — same keyword always gets same emoji

// ── Pure API Emoji Fetcher (no fallback functions) ────────────────────────
async function getCategoryEmoji(category, commandName = null) {
  if (!category) return "📦";

  // Smart cache key: name+category for details, category only for tree
  const cacheKey = commandName
    ? `${String(commandName).toLowerCase().trim()}-${String(category).toLowerCase().trim()}`
    : String(category).toLowerCase().trim();

  if (emojiCache.has(cacheKey)) return emojiCache.get(cacheKey);

  try {
    // Search term = meta.name + meta.category (for accurate emoji in details)
    const searchTerm = commandName
      ? `${commandName} ${category}`
      : category;

    const url = `${EMOJI_API_BASE}?q=${encodeURIComponent(searchTerm)}&limit=1`;
    const response = await fetch(url);

    if (!response.ok) throw new Error("API error");

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0 && data[0].emoji) {
      const emoji = data[0].emoji;
      emojiCache.set(cacheKey, emoji);
      return emoji;
    }
  } catch (err) {
    // API unreachable or no results → neutral safe emoji (pure API mode)
  }

  // Only neutral default when API truly cannot provide (rare)
  const neutral = "📦";
  emojiCache.set(cacheKey, neutral);
  return neutral;
}

// ── Resolve command by name OR alias ─────────────────────────────────────
function resolveCommand(target, commands) {
  target = String(target).toLowerCase().trim();
  if (!target) return null;

  let cmd = commands.get(target);
  if (cmd) return cmd;

  for (const [, c] of commands.entries()) {
    if (Array.isArray(c.meta?.aliases) &&
        c.meta.aliases.some(a => String(a).toLowerCase() === target)) {
      return c;
    }
  }
  return null;
}

// ── Visibility check ──────────────────────────────────────────────────────
function isCommandVisible(command, senderID, threadID) {
  const m       = command.meta || {};
  const reqType = (m.type || "anyone").toLowerCase();

  if (String(m.category || "").toLowerCase() === "hidden") return false;

  const userID   = String(senderID);
  const config   = global.config || {};
  const isDev    = Array.isArray(config.ADMINBOT) && config.ADMINBOT.includes(userID);
  const isPremium = Array.isArray(config.PREMIUM) && config.PREMIUM.includes(userID);

  let isGroupAdmin = false;
  try {
    const tID  = parseInt(threadID);
    const info = global.data.threadInfo?.get(tID) || global.data.threadInfo?.get(threadID);
    if (info?.adminIDs) {
      isGroupAdmin = info.adminIDs.some(a => String(a.id) === userID);
    }
  } catch { /* non-fatal */ }

  if (reqType === "anyone")     return true;
  if (reqType === "groupadmin") return isGroupAdmin || isDev;
  if (reqType === "premium")    return isPremium    || isDev;
  if (reqType === "developer")  return isDev;
  return false;
}

// ── Command detail block (pure API + name+category) ───────────────────────
async function buildCommandInfo(command, prefix) {
  const m = command.meta || {};

  const aliasesList = Array.isArray(m.aliases) && m.aliases.length
    ? m.aliases.map(a => String(a).toLowerCase()).join(", ")
    : "None";

  const guides = Array.isArray(m.guide) ? m.guide : [m.guide || ""];
  const usageLines = guides
    .map(g => g ? `${prefix}${m.name} ${g}` : `${prefix}${m.name}`)
    .join("\n");

  const catEmoji = await getCategoryEmoji(m.category, m.name);

  return (
    `${catEmoji} COMMAND INTERFACE\n\n` +
    `▫️ Name: ${m.name}\n` +
    `▫️ Version: v${m.version || "1.0.0"}\n` +
    `▫️ ${catEmoji} ${(m.category || "OTHER").toUpperCase()}\n` +
    `▫️ Type: ${(m.type || "anyone").toUpperCase()}\n` +
    `▫️ Cooldown: ${m.cooldowns || 0}s\n` +
    `▫️ Aliases: ${aliasesList}\n\n` +
    `📝 Description:\n${m.description || "No description provided."}\n\n` +
    `🕹️ Usage:\n${usageLines}`
  );
}

// ── Inline event trigger (e.g. "help <command>" without prefix) ───────────
export async function onEvent({ event, response }) {
  const { commands } = global.client;
  const { body }     = event;

  if (!body || body.indexOf("help") !== 0) return;

  const parts = body.slice(body.indexOf("help")).trim().split(/\s+/);
  if (parts.length < 2) return;

  const command = resolveCommand(parts[1].toLowerCase(), commands);
  if (!command) return;

  const threadSetting = global.data.threadData.get(parseInt(event.threadID)) || {};
  const prefix = Object.prototype.hasOwnProperty.call(threadSetting, "PREFIX")
    ? threadSetting.PREFIX
    : global.config.PREFIX;

  const info = await buildCommandInfo(command, prefix);
  return response.reply(info);
}

// ── Main command ──────────────────────────────────────────────────────────
export async function onStart({ event, args, response }) {
  const { commands }  = global.client;
  const { threadID, senderID } = event;

  const threadSetting = global.data.threadData.get(parseInt(threadID)) || {};
  const prefix  = Object.prototype.hasOwnProperty.call(threadSetting, "PREFIX")
    ? threadSetting.PREFIX
    : global.config.PREFIX;
  const botName = (global.config.BOTNAME || "BOT").toUpperCase();
  const targetArg = (args[0] || "").toLowerCase().trim();

  // ── Specific command info ─────────────────────────────────────────────
  if (targetArg && targetArg !== "all" && isNaN(Number(targetArg))) {
    const command = resolveCommand(targetArg, commands);
    if (command) {
      const info = await buildCommandInfo(command, prefix);
      return response.reply(info);
    }
  }

  // ── Full tree view ────────────────────────────────────────────────────
  if (targetArg === "all") {
    const grouped = {};
    for (const [, value] of commands) {
      if (!isCommandVisible(value, senderID, threadID)) continue;
      const cat = value.meta.category || "other";
      (grouped[cat] = grouped[cat] || []).push(value.meta.name);
    }

    let msg = `${botName} COMMAND TREE\n\n`;

    // Pure API calls in parallel
    const catEntries = Object.entries(grouped).sort();
    const catPromises = catEntries.map(async ([cat, names]) => {
      const emoji = await getCategoryEmoji(cat); // category only → consistent
      let block = `${emoji} ${cat.toUpperCase()}\n`;
      for (const name of names.sort()) block += ` ▫️ ${prefix}${name}\n`;
      block += "\n";
      return block;
    });

    const catBlocks = await Promise.all(catPromises);
    msg += catBlocks.join("");

    const total = Object.values(grouped).reduce((s, a) => s + a.length, 0);
    msg += `Total Visible Commands: ${total}`;

    return response.reply(msg);
  }

  // ── Paginated list ────────────────────────────────────────────────────
  const perPage  = 10;
  const page     = parseInt(targetArg) || 1;
  const arrayInfo = [];

  for (const [, value] of commands) {
    if (isCommandVisible(value, senderID, threadID)) {
      arrayInfo.push({
        name:        value.meta.name,
        description: value.meta.description || "No description provided."
      });
    }
  }

  arrayInfo.sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.ceil(arrayInfo.length / perPage);
  const safePage   = Math.min(Math.max(page, 1), totalPages || 1);
  const start      = perPage * safePage - perPage;
  const slice      = arrayInfo.slice(start, start + perPage);

  let msg = `${botName} COMMAND CENTER\n\n`;
  for (const { name, description } of slice) {
    msg += `▫️${prefix}${name}\n   ↳ ${description}\n\n`;
  }
  msg +=
    `Page ${safePage}/${totalPages} | ${arrayInfo.length} Visible Commands\n` +
    `Type ${prefix}help <command> for detailed info\n` +
    `${prefix}help all — full tree view\n` +
    `${prefix}help <page> — navigate pages`;

  return response.reply(msg);
}