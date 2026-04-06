/**
 * join.js
 * -------
 * Lists all groups the bot is in and lets a user request to be added.
 * Requires developer permission (type: developer).
 */

export const meta = {
  name:        'join',
  aliases:     [],
  version:     '1.0.1',
  type:        'developer',
  author:      'Henry | Converted by AjiroDesu',
  description: 'List all groups the bot is in and join one.',
  category:    'system',
  guide:       [''],
  cooldowns:   5,
};

export async function onStart({ api, event, Threads, response }) {
  const { threadID, senderID } = event;

  const allThreads = await Threads.getAll();

  if (!allThreads.length) {
    return response.reply('📭 The bot is not currently in any groups.');
  }

  const IDs = [];
  let msg   = '🔰 BOX LIST 🔰\n\n';

  allThreads.forEach((t, i) => {
    msg += `${i + 1}. ${t.threadInfo?.threadName || `Group ${t.threadID}`}\n`;
    IDs.push(t.threadID);
  });

  msg += '\n👉 Reply with the number of the group you want to join.';

  const info = await new Promise((resolve) =>
    api.sendMessage(msg, threadID, (err, res) => resolve(res), event.messageID)
  );

  if (!info?.messageID) return;

  global.client.onReply.push({
    name:      meta.name,
    author:    senderID,
    messageID: info.messageID,
    IDs,
  });
}

export async function onReply({ api, event, Threads, onReply: replyData }) {
  const { threadID, messageID, senderID, body } = event;
  const { IDs } = replyData;

  const pick = parseInt(body?.trim());
  if (!pick || isNaN(pick)) {
    return api.sendMessage('⚠️ Your selection must be a number.', threadID, messageID);
  }
  if (pick < 1 || pick > IDs.length) {
    return api.sendMessage(`⚠️ Pick a number between 1 and ${IDs.length}.`, threadID, messageID);
  }

  const targetID = IDs[pick - 1];

  try {
    const threadInfo = await Threads.getInfo(targetID);
    const { participantIDs, approvalMode, adminIDs, threadName } = threadInfo;

    if (participantIDs.includes(senderID)) {
      return api.sendMessage('⚠️ You are already in that group.', threadID, messageID);
    }

    await api.addUserToGroup(senderID, targetID);

    const botID        = api.getCurrentUserID();
    const botIsAdmin   = adminIDs?.some(a => String(a.id) === String(botID));
    const needApproval = approvalMode && !botIsAdmin;

    return api.sendMessage(
      needApproval
        ? `✅ Added you to the approval list of "${threadName}". Check your pending invites.`
        : `✅ You have been added to "${threadName}". Check your messages or spam folder!`,
      threadID, messageID,
    );
  } catch (error) {
    return api.sendMessage(`❌ Could not add you to that group.\n\n${error.message}`, threadID, messageID);
  }
}
