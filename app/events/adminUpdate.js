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
    sendNoti:     true,
    autoUnsend:   false,
    timeToUnsend: 10,
  },
};

/**
 * Auto-unsend a sent message after a delay if autoUnsend is enabled.
 * @param {object} response - response wrapper
 * @param {{ messageID: string }|null} info
 * @param {object} config
 */
async function tryUnsend(response, info, config) {
  if (config?.autoUnsend && info?.messageID) {
    await new Promise(r => setTimeout(r, (config.timeToUnsend || 10) * 1000));
    await response.unsend(info.messageID);
  }
}

export async function onEvent({ event, Threads, response }) {
  const { threadID, logMessageType, logMessageData } = event;
  const cfg = global.configCmd?.adminUpdate || meta.envConfig;

  const threadEntry = global.data.threadData.get(threadID) || {};
  if (threadEntry.adminUpdate === false) return;

  try {
    const row        = await Threads.getData(threadID);
    let   dataThread = row?.threadInfo || {};

    switch (logMessageType) {

      case 'log:thread-admins': {
        const isAdd = logMessageData.ADMIN_EVENT === 'add_admin';
        if (isAdd) {
          dataThread.adminIDs = [
            ...(dataThread.adminIDs || []),
            { id: logMessageData.TARGET_ID },
          ];
          if (cfg.sendNoti) {
            const info = await response.send(
              `📢 User ${logMessageData.TARGET_ID} has been promoted to group admin.`,
              threadID,
            );
            await tryUnsend(response, info, cfg);
          }
        } else {
          dataThread.adminIDs = (dataThread.adminIDs || [])
            .filter(a => a.id !== logMessageData.TARGET_ID);
          if (cfg.sendNoti) {
            const info = await response.send(
              `📢 User ${logMessageData.TARGET_ID} has been removed from group admin.`,
              threadID,
            );
            await tryUnsend(response, info, cfg);
          }
        }
        break;
      }

      case 'log:thread-icon': {
        const newIcon = logMessageData.thread_icon || '👍';
        dataThread.threadIcon = newIcon;
        if (cfg.sendNoti) {
          const info = await response.send(
            `🖼️ Group icon has been changed to: ${newIcon}`,
            threadID,
          );
          await tryUnsend(response, info, cfg);
        }
        break;
      }

      case 'log:thread-color': {
        dataThread.threadColor = logMessageData.thread_color || '';
        if (cfg.sendNoti) {
          const info = await response.send(
            `🎨 Group theme color has been updated.`,
            threadID,
          );
          await tryUnsend(response, info, cfg);
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
          const info = await response.send(
            `✏️ Nickname of user ${logMessageData.participant_id} changed to: ${newNick}`,
            threadID,
          );
          await tryUnsend(response, info, cfg);
        }
        break;
      }

      case 'log:thread-name': {
        const newName = logMessageData.name || 'Unnamed';
        dataThread.threadName = newName;
        if (cfg.sendNoti) {
          const info = await response.send(
            `📝 Group name changed to: ${newName}`,
            threadID,
          );
          await tryUnsend(response, info, cfg);
        }
        break;
      }
    }

    await Threads.setData(threadID, { threadInfo: dataThread });
  } catch (e) {
    console.error('[adminUpdate]', e.message);
  }
}
