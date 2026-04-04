export const meta = {
  name:        'antirobbery',
  version:     '1.0.0',
  author:      'D-Jukie',
  description: 'Prevents unauthorized admin promotions/demotions when guard mode is enabled.',
  eventType:   ['log:thread-admins'],
};

export async function onEvent({ api, event, Threads, response }) {
  const { threadID, logMessageType, logMessageData, author } = event;

  const row  = await Threads.getData(threadID);
  const data = row?.data || {};
  if (!data.guard) return;

  if (logMessageType !== 'log:thread-admins') return;

  const botID = api.getCurrentUserID();

  // Never interfere with the bot's own actions or the bot being targeted
  if (author === botID || logMessageData.TARGET_ID === botID) return;

  if (logMessageData.ADMIN_EVENT === 'add_admin') {
    // Revoke unauthorized promotion
    try {
      await response.call('changeAdminStatus', threadID, logMessageData.TARGET_ID, false);
      await response.send('🛡️ Guard mode: unauthorized admin promotion was blocked.', threadID);
    } catch {
      await response.send('⚠️ Guard mode: failed to revert admin promotion.', threadID);
    }
    // Also demote the person who triggered it (fire-and-forget)
    response.call('changeAdminStatus', threadID, author, false).catch(() => {});

  } else if (logMessageData.ADMIN_EVENT === 'remove_admin') {
    // Restore the demoted admin
    try {
      await response.call('changeAdminStatus', threadID, logMessageData.TARGET_ID, true);
      await response.send('🛡️ Guard mode: unauthorized admin removal was blocked.', threadID);
    } catch {
      await response.send('⚠️ Guard mode: failed to restore admin status.', threadID);
    }
    // Also demote the person who triggered it (fire-and-forget)
    response.call('changeAdminStatus', threadID, author, false).catch(() => {});
  }
}
