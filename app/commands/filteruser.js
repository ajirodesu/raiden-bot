// ── Shared utilities ────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

const toID = v => String(v ?? '').trim();

function getAdminIDs(threadInfo = {}) {
  return (Array.isArray(threadInfo.adminIDs) ? threadInfo.adminIDs : [])
    .map(a => (a && typeof a === 'object' ? toID(a.id) : toID(a)))
    .filter(Boolean);
}

function isBotAdmin(threadInfo, botID) {
  return getAdminIDs(threadInfo).includes(toID(botID));
}

function getMessageCount(member) {
  const raw = member?.messageCount ?? member?.count ?? member?.msgCount ?? member?.messages ?? 0;
  const n   = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function isDisabledAccount(member) {
  const type = String(member?.type ?? member?.accountType ?? '').toLowerCase();
  return (
    member?.disabled       === true ||
    member?.isDisabled     === true ||
    member?.accountDisabled === true ||
    type === 'disabled' || type === 'deactivated' || type === 'locked'
  );
}

function isRegularUser(member) {
  const type = String(member?.type ?? '').toLowerCase();
  return !type || type === 'user';
}

function shouldSkip(memberID, botID, adminIDs) {
  const id = toID(memberID);
  return !id || id === toID(botID) || adminIDs.includes(id);
}

/** Remove a list of members from a thread. Returns { success[], failed[] }. */
async function removeMembers(api, members, threadID, botID, adminIDs) {
  const success = [], failed = [];
  for (const member of members) {
    const memberID = toID(member.id);
    if (shouldSkip(memberID, botID, adminIDs)) continue;
    try {
      await api.removeUserFromGroup(memberID, threadID);
      success.push(memberID);
    } catch {
      failed.push(member?.name || memberID);
    }
    await sleep(700);
  }
  return { success, failed };
}

function buildResultMessage(success, failed, context) {
  let msg = '';
  if (success.length) msg += `🟢 Removed ${success.length} ${context}.\n`;
  if (failed.length)  msg += `🔴 Failed to remove ${failed.length} user(s):\n${failed.join('\n')}\n`;
  return msg.trim() || context;
}

// ── Command ─────────────────────────────────────────────────────────────
export const meta = {
  name:        'filteruser',
  aliases:     ['filter'],
  version:     '3.4.0',
  type:        'groupadmin',
  author:      'NTKhang | Converted by AjiroDesu | Optimized',
  description: 'Filter group members by message count or remove disabled/locked accounts.',
  category:    'group',
  guide:       ['<number>', 'die'],
  cooldowns:   5,
};

export async function onStart({ api, event, args, response, usage }) {
  const threadID = toID(event.threadID);
  const senderID = toID(event.senderID);
  const botID    = toID(api.getCurrentUserID());

  const threadInfo = await response.getThreadInfo(threadID);
  if (!threadInfo) return response.reply('🔴 Unable to load thread information.');

  if (!isBotAdmin(threadInfo, botID)) {
    return response.reply('⚠️ Please add the bot as a group admin to use this command.');
  }

  const adminIDs = getAdminIDs(threadInfo);
  const members  = Array.isArray(threadInfo.userInfo) ? threadInfo.userInfo : [];
  const mode     = toID(args[0]).toLowerCase();

  // ── Die mode: remove disabled/locked accounts ────────────────────────
  if (mode === 'die') {
    const targets = members.filter(m => {
      if (shouldSkip(toID(m?.id), botID, adminIDs)) return false;
      return !isRegularUser(m) || isDisabledAccount(m);
    });

    const { success, failed } = await removeMembers(api, targets, threadID, botID, adminIDs);
    const msg = buildResultMessage(success, failed,
      success.length ? `${success.length} disabled/locked account(s)` : '🟢 No disabled/locked accounts found.');
    return response.reply(msg);
  }

  // ── Message-count mode ───────────────────────────────────────────────
  const minimum = Number(mode);
  if (Number.isFinite(minimum) && minimum >= 0) {
    const info = await response.reply(
      `⚠️ Are you sure you want to remove members with less than ${minimum} messages?\nReact to confirm.`,
    );
    return response.addReaction({ messageID: info.messageID, name: meta.name, author: senderID, minimum, threadID });
  }

  return typeof usage === 'function' ? usage() : response.reply('🔴 Invalid usage. Use: filteruser <number> or filteruser die');
}

export async function onReaction({ api, event, response, onReaction }) {
  const threadID = toID(event.threadID);
  const userID   = toID(event.userID);
  const author   = toID(onReaction.author);
  const minimum  = Number(onReaction.minimum);
  const botID    = toID(api.getCurrentUserID());

  if (userID !== author) return;
  if (!Number.isFinite(minimum) || minimum < 0) return response.reply('🔴 Invalid confirmation data.');

  const threadInfo = await response.getThreadInfo(threadID);
  if (!threadInfo) return response.reply('🔴 Unable to load thread information.');

  const adminIDs = getAdminIDs(threadInfo);
  const members  = (Array.isArray(threadInfo.userInfo) ? threadInfo.userInfo : []).filter(m => {
    if (shouldSkip(toID(m?.id), botID, adminIDs)) return false;
    return isRegularUser(m) && getMessageCount(m) < minimum;
  });

  const { success, failed } = await removeMembers(api, members, threadID, botID, adminIDs);
  const fallback = `🟢 No members found with less than ${minimum} messages.`;
  return response.reply(
    buildResultMessage(success, failed,
      success.length ? `${success.length} member(s) with less than ${minimum} message(s)` : fallback)
  );
}
