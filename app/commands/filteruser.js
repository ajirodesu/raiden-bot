function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toID(value) {
  return String(value ?? '').trim();
}

function getAdminIDs(threadInfo = {}) {
  const rawAdmins = Array.isArray(threadInfo.adminIDs) ? threadInfo.adminIDs : [];
  return rawAdmins
    .map(admin => {
      if (admin && typeof admin === 'object') return toID(admin.id);
      return toID(admin);
    })
    .filter(Boolean);
}

function isBotAdmin(threadInfo, botID) {
  const admins = getAdminIDs(threadInfo);
  return admins.includes(toID(botID));
}

function getMessageCount(member) {
  const raw =
    member?.messageCount ??
    member?.count ??
    member?.msgCount ??
    member?.messages ??
    0;

  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function isDisabledAccount(member) {
  const type = String(member?.type ?? member?.accountType ?? '').toLowerCase();

  return (
    member?.disabled === true ||
    member?.isDisabled === true ||
    member?.accountDisabled === true ||
    type === 'disabled' ||
    type === 'deactivated' ||
    type === 'locked'
  );
}

function isRegularUser(member) {
  const type = String(member?.type ?? '').toLowerCase();
  if (!type) return true;
  return type === 'user';
}

function shouldSkipMember(memberID, botID, adminIDs) {
  const id = toID(memberID);
  return !id || id === toID(botID) || adminIDs.includes(id);
}

export const meta = {
  name: 'filteruser',
  aliases: ['filter'],
  version: '3.3.0',
  type: 'groupadmin',
  author: 'NTKhang | Converted by AjiroDesu | Fixed for this source',
  description: 'Filter group members by message count or locked/disabled accounts.',
  category: 'group',
  guide: ['<number>', 'die'],
  cooldowns: 5
};

export async function onStart({ api, event, args, response, usage }) {
  const threadID = toID(event.threadID);
  const senderID = toID(event.senderID);
  const botID = toID(api.getCurrentUserID());

  const threadInfo = await response.getThreadInfo(threadID);
  if (!threadInfo) {
    return response.reply('❌ Unable to load thread information for this chat.');
  }

  if (!isBotAdmin(threadInfo, botID)) {
    return response.reply('⚠️ Please add the bot as a group admin to use this command.');
  }

  const adminIDs = getAdminIDs(threadInfo);
  const mode = toID(args[0]).toLowerCase();

  if (mode === 'die') {
    const members = Array.isArray(threadInfo.userInfo) ? threadInfo.userInfo : [];

    const targets = members.filter(member => {
      const memberID = toID(member?.id);
      if (shouldSkipMember(memberID, botID, adminIDs)) return false;

      return !isRegularUser(member) || isDisabledAccount(member);
    });

    const success = [];
    const failed = [];

    for (const member of targets) {
      const memberID = toID(member.id);
      try {
        await api.removeUserFromGroup(memberID, threadID);
        success.push(memberID);
      } catch {
        failed.push(member?.name || memberID);
      }
      await sleep(700);
    }

    let msg = '';
    if (success.length) msg += `✅ Removed ${success.length} disabled/locked account(s).\n`;
    if (failed.length) msg += `❌ Failed to remove ${failed.length} user(s):\n${failed.join('\n')}\n`;
    if (!msg) msg = '✅ No disabled/locked accounts found.';

    return response.reply(msg.trim());
  }

  const minimum = Number(mode);
  if (Number.isFinite(minimum) && minimum >= 0) {
    const info = await response.reply(
      `⚠️ Are you sure you want to remove members with less than ${minimum} messages?\nReact to confirm.`
    );

    return response.addReaction({
      messageID: info.messageID,
      name: meta.name,
      author: senderID,
      minimum,
      threadID
    });
  }

  if (typeof usage === 'function') {
    return usage();
  }

  return response.reply('❌ Invalid usage.\nUse: filteruser <number> or filteruser die');
}

export async function onReaction({ api, event, response, onReaction }) {
  const threadID = toID(event.threadID);
  const userID = toID(event.userID);
  const author = toID(onReaction.author);
  const minimum = Number(onReaction.minimum);
  const botID = toID(api.getCurrentUserID());

  if (userID !== author) return;
  if (!Number.isFinite(minimum) || minimum < 0) {
    return response.reply('❌ Invalid confirmation data.');
  }

  const threadInfo = await response.getThreadInfo(threadID);
  if (!threadInfo) {
    return response.reply('❌ Unable to load thread information for this chat.');
  }

  const adminIDs = getAdminIDs(threadInfo);
  const members = Array.isArray(threadInfo.userInfo) ? threadInfo.userInfo : [];

  const targets = members.filter(member => {
    const memberID = toID(member?.id);
    if (shouldSkipMember(memberID, botID, adminIDs)) return false;
    if (!isRegularUser(member)) return false;
    return getMessageCount(member) < minimum;
  });

  const success = [];
  const failed = [];

  for (const member of targets) {
    const memberID = toID(member.id);
    try {
      await api.removeUserFromGroup(memberID, threadID);
      success.push(memberID);
    } catch {
      failed.push(member?.name || memberID);
    }
    await sleep(700);
  }

  let msg = '';
  if (success.length) msg += `✅ Removed ${success.length} member(s) with less than ${minimum} message(s).\n`;
  if (failed.length) msg += `❌ Failed to remove ${failed.length} user(s):\n${failed.join('\n')}\n`;
  if (!msg) msg = `✅ No members found with less than ${minimum} messages.`;

  return response.reply(msg.trim());
}