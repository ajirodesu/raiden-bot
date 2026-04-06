/**
 * unsend.js
 * ---------
 * Unsends a bot message by replying to it and calling this command.
 */

export const meta = {
  name:        'unsend',
  version:     '1.2',
  author:      'AjiroDesu',
  type:        'anyone',
  description: "Unsend one of the bot's messages by replying to it.",
  category:    'utility',
  guide:       ['(reply to a bot message)'],
  cooldowns:   5,
};

export async function onStart({ event, api, response, usage }) {
  const { messageReply } = event;

  if (!messageReply || String(messageReply.senderID) !== String(api.getCurrentUserID()))
    return usage();

  return response.unsend(messageReply.messageID);
}