export const meta = {
  name:        'uid',
  version:     '1.0.0',
  type:        'anyone',       // anyone | groupadmin | premium | developer
  author:      'AjiroDesu',
  description: 'Get the User ID of yourself, a replied message, or a mention.',
  category:    'utility',
  guide:       ['uid', 'uid @mention', '(reply to someone) uid'],
  cooldowns:   5,
};

export async function onStart({ api, event, args, response }) {
  const { senderID, messageID } = event;

  let uid = senderID;

  // Reply target
  if (event.type === 'message_reply') {
    uid = event.messageReply.senderID;
  }

  // Mention target
  if (args.join(' ').includes('@') && event.mentions) {
    const mentioned = Object.keys(event.mentions)[0];
    if (mentioned) uid = mentioned;
  }

  return response.reply(`🪪 User ID: ${uid}`);
}