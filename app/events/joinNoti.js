export const meta = {
  name:        'joinNoti',
  version:     '3.1.0',
  author:      'AjiroDesu',
  description: 'Sends a welcome message when new members join the group.',
  eventType:   ['log:subscribe'],
};

export async function onEvent({ api, event, response }) {
  const { threadID, logMessageData } = event;
  const addedParticipants = logMessageData.addedParticipants || [];

  // ── Bot was added to a new group ──────────────────────────────────────
  if (addedParticipants.some(p => p.userFbId === api.getCurrentUserID())) {
    const botName = global.config.BOTNAME || 'Raiden';
    const prefix  = global.config.PREFIX  || '/';
    api.changeNickname(`» ${prefix} « ${botName}`, threadID, api.getCurrentUserID());
    return response.send(
      `👋 ${botName} connected successfully!\nThank you for adding me. Type ${prefix}help to get started! 🎉`,
      threadID,
    );
  }

  // ── Regular members joined ────────────────────────────────────────────
  try {
    const { threadName, participantIDs } = await api.getThreadInfo(threadID);
    const threadData = global.data.threadData.get(String(threadID)) || {};

    const nameArray = [];

    for (const participant of addedParticipants) {
      const userID = participant.userFbId;
      if (userID === api.getCurrentUserID()) continue;

      const name = participant.fullName
        || global.data.userName.get(String(userID))
        || 'New Member';

      nameArray.push(name);
    }

    if (!nameArray.length) return;

    const memberCount = participantIDs.length;
    const customMsg   = threadData.customJoin;

    let body = customMsg ||
      `🎉 Welcome, {uName}!\n` +
      `┌────── ～●～ ──────┐\n` +
      `   Welcome to {threadName}!  \n` +
      `└────── ～●～ ──────┘\n` +
      `You are member #{memberCount}. Enjoy your stay! 🥳`;

    body = body
      .replace(/\{uName}/g,       nameArray.join(', '))
      .replace(/\{threadName}/g,  threadName)
      .replace(/\{memberCount}/g, String(memberCount));

    return response.send(body, threadID);
  } catch (err) {
    console.error('[joinNoti]', err.message);
  }
}
