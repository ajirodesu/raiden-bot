export const meta = {
  name:        'antiout',
  version:     '1.0.0',
  author:      'DungUwU',
  description: 'Re-adds members who leave the group when anti-out mode is enabled.',
  eventType:   ['log:unsubscribe'],
};

export async function onEvent({ api, event, Users, Threads }) {
  const { threadID, logMessageData, author } = event;
  const leftID = logMessageData.leftParticipantFbId;

  // Never try to re-add the bot itself
  if (leftID === api.getCurrentUserID()) return;

  const row  = await Threads.getData(threadID);
  const data = row?.data || {};
  if (data.antiout === false) return;

  const name   = global.data.userName.get(leftID) || await Users.getNameUser(leftID);
  const isSelf = author === leftID;

  if (isSelf) {
    api.addUserToGroup(leftID, threadID, (err) => {
      if (err) {
        api.sendMessage(`❌ Unable to re-add ${name}. They may have blocked the bot.`, threadID);
      } else {
        api.sendMessage(`🔒 ${name} tried to leave but was re-added. Anti-Out is active!`, threadID);
      }
    });
  }
}