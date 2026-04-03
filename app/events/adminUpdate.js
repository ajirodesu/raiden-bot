export const meta = {
  name:      'adminUpdate',
  version:   '1.0.1',
  author:    'Mirai Team',
  description: 'Tracks and updates thread admin, name, icon, color, and nickname changes.',
  eventType: [
    'log:thread-admins',
    'log:thread-name',
    'log:user-nickname',
    'log:thread-icon',
    'log:thread-color',
  ],
  envConfig: {
    sendNoti:   true,
    autoUnsend: false,
    timeToUnsend: 10,
  },
};

async function tryUnsend(api, info, config) {
  if (config?.autoUnsend && info?.messageID) {
    await new Promise(r => setTimeout(r, (config.timeToUnsend || 10) * 1000));
    api.unsendMessage(info.messageID);
  }
}

export async function onEvent({ api, event, Threads }) {
  const { threadID, logMessageType, logMessageData, logMessageBody } = event;
  const cfg = global.configModule?.adminUpdate || meta.envConfig;

  const threadEntry = global.data.threadData.get(threadID) || {};
  if (threadEntry.adminUpdate === false) return;

  try {
    const row        = await Threads.getData(threadID);
    let   dataThread = row?.threadInfo || {};

    switch (logMessageType) {

      case 'log:thread-admins': {
        const isAdd = logMessageData.ADMIN_EVENT === 'add_admin';
        if (isAdd) {
          dataThread.adminIDs = [...(dataThread.adminIDs || []), { id: logMessageData.TARGET_ID }];
          if (cfg.sendNoti) {
            api.sendMessage(
              `📢 User ${logMessageData.TARGET_ID} has been promoted to group admin.`,
              threadID,
              async (err, info) => tryUnsend(api, info, cfg),
            );
          }
        } else {
          dataThread.adminIDs = (dataThread.adminIDs || []).filter(a => a.id !== logMessageData.TARGET_ID);
          if (cfg.sendNoti) {
            api.sendMessage(
              `📢 User ${logMessageData.TARGET_ID} has been removed from group admin.`,
              threadID,
              async (err, info) => tryUnsend(api, info, cfg),
            );
          }
        }
        break;
      }

      case 'log:thread-icon': {
        const newIcon = logMessageData.thread_icon || '👍';
        dataThread.threadIcon = newIcon;
        if (cfg.sendNoti) {
          api.sendMessage(
            `🖼️ Group icon has been changed to: ${newIcon}`,
            threadID,
            async (err, info) => tryUnsend(api, info, cfg),
          );
        }
        break;
      }

      case 'log:thread-color': {
        dataThread.threadColor = logMessageData.thread_color || '';
        if (cfg.sendNoti) {
          api.sendMessage(
            `🎨 Group theme color has been updated.`,
            threadID,
            async (err, info) => tryUnsend(api, info, cfg),
          );
        }
        break;
      }

      case 'log:user-nickname': {
        if (!dataThread.nicknames) dataThread.nicknames = {};
        dataThread.nicknames[logMessageData.participant_id] = logMessageData.nickname;
        if (cfg.sendNoti) {
          const newNick = logMessageData.nickname?.length
            ? logMessageData.nickname
            : '(original name)';
          api.sendMessage(
            `✏️ Nickname of user ${logMessageData.participant_id} changed to: ${newNick}`,
            threadID,
            async (err, info) => tryUnsend(api, info, cfg),
          );
        }
        break;
      }

      case 'log:thread-name': {
        const newName = logMessageData.name || 'Unnamed';
        dataThread.threadName = newName;
        if (cfg.sendNoti) {
          api.sendMessage(
            `📝 Group name changed to: ${newName}`,
            threadID,
            async (err, info) => tryUnsend(api, info, cfg),
          );
        }
        break;
      }
    }

    await Threads.setData(threadID, { threadInfo: dataThread });
  } catch (e) {
    console.error('[adminUpdate]', e.message);
  }
}