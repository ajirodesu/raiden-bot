export const meta = {
  name:        'log',
  version:     '1.0.0',
  author:      'Mirai Team',
  description: 'Logs bot activity (joining/leaving groups, name changes) and reports to admin.',
  eventType:   ['log:unsubscribe', 'log:subscribe', 'log:thread-name'],
  envConfig: {
    enable: true,
  },
};

export async function onEvent({ api, event, Threads }) {
  const cfg = global.configModule?.log || meta.envConfig;
  if (!cfg.enable) return;

  const { threadID, logMessageType, logMessageData, author } = event;
  const adminID = global.config.ADMINBOT?.[0];
  if (!adminID) return;

  let task = '';

  switch (logMessageType) {
    case 'log:thread-name': {
      const newName = logMessageData.name || '(unnamed)';
      let   oldName = '(unknown)';
      try {
        const row = await Threads.getData(threadID);
        oldName = row?.threadInfo?.threadName || oldName;
        await Threads.setData(threadID, { threadInfo: { ...row?.threadInfo, threadName: newName } });
      } catch { /* non-fatal */ }
      task = `Group name changed from "${oldName}" to "${newName}".`;
      break;
    }
    case 'log:subscribe': {
      if (logMessageData.addedParticipants?.some(p => p.userFbId === api.getCurrentUserID())) {
        task = `Bot was added to group ${threadID}.`;
      }
      break;
    }
    case 'log:unsubscribe': {
      if (logMessageData.leftParticipantFbId === api.getCurrentUserID()) {
        task = `Bot was removed from group ${threadID}.`;
      }
      break;
    }
    default:
      break;
  }

  if (!task) return;

  const report =
    `🤖 Bot Notification\n` +
    `──────────────────\n` +
    `📌 Group ID : ${threadID}\n` +
    `📋 Action   : ${task}\n` +
    `👤 By       : ${author}\n` +
    `🕐 Time     : ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`;

  api.sendMessage(report, adminID, (err) => {
    if (err) console.error('[log event] Failed to send report to admin:', err);
  });
}