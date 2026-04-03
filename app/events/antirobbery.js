export const meta = {
  name:        'antirobbery',
  version:     '1.0.0',
  author:      'D-Jukie',
  description: 'Prevents unauthorized admin promotions/demotions when guard mode is enabled.',
  eventType:   ['log:thread-admins'],
};

export async function onEvent({ api, event, Threads }) {
  const { threadID, logMessageType, logMessageData, author } = event;

  const row  = await Threads.getData(threadID);
  const data = row?.data || {};
  if (!data.guard) return;

  if (logMessageType !== 'log:thread-admins') return;

  const botID = api.getCurrentUserID();

  // Never interfere with the bot's own actions
  if (author === botID) return;
  if (logMessageData.TARGET_ID === botID) return;

  if (logMessageData.ADMIN_EVENT === 'add_admin') {
    // Revoke unauthorized promotion of any user
    api.changeAdminStatus(threadID, logMessageData.TARGET_ID, false, (err) => {
      if (err) {
        api.sendMessage('⚠️ Guard mode: failed to revert admin promotion.', threadID);
      } else {
        api.sendMessage('🛡️ Guard mode: unauthorized admin promotion was blocked.', threadID);
      }
    });
    // Also demote the person who did it
    api.changeAdminStatus(threadID, author, false);
  } else if (logMessageData.ADMIN_EVENT === 'remove_admin') {
    // Restore the demoted admin
    api.changeAdminStatus(threadID, logMessageData.TARGET_ID, true, (err) => {
      if (err) {
        api.sendMessage('⚠️ Guard mode: failed to restore admin status.', threadID);
      } else {
        api.sendMessage('🛡️ Guard mode: unauthorized admin removal was blocked.', threadID);
      }
    });
    // Also demote the person who did it
    api.changeAdminStatus(threadID, author, false);
  }
}