/**
 * prefix.js
 * ---------
 * Shows the current global and group-specific prefix.
 * Group admins can set a custom prefix for their group.
 *
 * onStart  → !prefix [set <new>|reset]
 * onEvent  → detects anyone saying "prefix" at the start of a message
 *            and replies with the current prefix info (no command prefix needed).
 */

export const meta = {
  name:        'prefix',
  aliases:     [],
  version:     '1.0.0',
  type:        'anyone',
  author:      'AjiroDesu',
  description: 'Show or set the prefix for this group.',
  category:    'system',
  guide:       ['', 'set <new_prefix>', 'reset'],
  cooldowns:   3,
};

// ── Helpers ───────────────────────────────────────────────────────────────

function getGlobalPrefix() {
  return global.config?.PREFIX || '+';
}

function getGroupPrefix(threadID) {
  const threadSetting = global.data.threadData.get(String(threadID)) || {};
  return threadSetting.PREFIX || null;
}

function buildInfoMessage(threadID) {
  const globalPrefix = getGlobalPrefix();
  const groupPrefix  = getGroupPrefix(threadID);

  return (
    `🤖 Prefix Info\n\n` +
    `🌐 Global prefix: ${globalPrefix}\n` +
    `💬 Group prefix:  ${groupPrefix ? groupPrefix : `(none — using global: ${globalPrefix})`}\n\n` +
    `Active prefix for this group: ${groupPrefix || globalPrefix}`
  );
}

// ── onStart — command handler ─────────────────────────────────────────────

export async function onStart({ api, event, args, Threads, response }) {
  const { threadID, senderID } = event;
  const tID = String(threadID);

  // No args → show current prefix info
  if (!args[0]) {
    return response.reply(buildInfoMessage(threadID));
  }

  const sub = args[0].toLowerCase();

  // Only group admins / bot admins can set/reset
  const ADMINBOT   = global.config?.ADMINBOT || [];
  const isDev      = ADMINBOT.includes(String(senderID));
  const threadInfo = global.data.threadInfo?.get(tID);
  const isAdmin    = isDev || (threadInfo?.adminIDs || []).some(a => String(a.id) === String(senderID));

  if (!isAdmin) {
    return response.reply('⚠️ Only group admins can change the prefix.');
  }

  // ── set <new_prefix> ──────────────────────────────────────────────────
  if (sub === 'set') {
    const newPrefix = args[1];
    if (!newPrefix || newPrefix.length > 5) {
      return response.reply('⚠️ Please provide a valid prefix (max 5 characters).\nExample: prefix set !');
    }

    const threadRow = await Threads.getData(tID);
    const data      = threadRow?.data || {};
    data.PREFIX     = newPrefix;

    await Threads.setData(tID, { data });

    // Update in-memory threadData so it takes effect immediately
    const current   = global.data.threadData.get(tID) || {};
    current.PREFIX  = newPrefix;
    global.data.threadData.set(tID, current);

    return response.reply(`✅ Group prefix has been set to: ${newPrefix}`);
  }

  // ── reset ─────────────────────────────────────────────────────────────
  if (sub === 'reset') {
    const threadRow = await Threads.getData(tID);
    const data      = threadRow?.data || {};
    delete data.PREFIX;

    await Threads.setData(tID, { data });

    const current = global.data.threadData.get(tID) || {};
    delete current.PREFIX;
    global.data.threadData.set(tID, current);

    return response.reply(`✅ Group prefix has been reset. Using global prefix: ${getGlobalPrefix()}`);
  }

  return response.reply(
    `⚠️ Unknown sub-command.\nUsage:\n` +
    `  prefix           — show prefix info\n` +
    `  prefix set <p>   — set group prefix\n` +
    `  prefix reset     — restore global prefix`
  );
}

// ── onEvent — passive listener ────────────────────────────────────────────
// Fires on every message. If the message starts with the word "prefix"
// (case-insensitive, ignoring leading spaces) the bot replies with prefix info.

export async function onEvent({ event, response }) {
  const { body, senderID, threadID } = event;
  if (!body) return;

  const trimmed = body.trim();

  // Match messages that are exactly "prefix" or start with "prefix " / "prefix?"
  if (/^prefix(\s.*|[?!].*)?$/i.test(trimmed)) {
    // Avoid infinite loops — don't respond to the bot itself
    const botID = String(global.client?.api?.getCurrentUserID?.() || '');
    if (botID && String(senderID) === botID) return;

    return response.reply(buildInfoMessage(threadID));
  }
}
