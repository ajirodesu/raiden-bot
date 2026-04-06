export const meta = {
  name:        'uid',
  aliases:     ['id', 'getid'],
  version:     '1.0.0',
  type:        'anyone',
  author:      'AjiroDesu',
  description: 'Get the Facebook user ID of yourself or a tagged person.',
  category:    'utility',
  guide:       ['', '@mention'],
  cooldowns:   5,
};

export async function onStart({ event, response }) {
  const { senderID, mentions } = event;

  const mentionIDs = Object.keys(mentions || {});

  if (!mentionIDs.length) {
    return response.reply(`🔖 Your User ID: ${senderID}`);
  }

  const lines = mentionIDs.map(id => {
    const name = (mentions[id] || '').replace(/@/g, '').trim() || `User ${id}`;
    return `🔖 ${name}: ${id}`;
  });

  return response.reply(lines.join('\n'));
}
