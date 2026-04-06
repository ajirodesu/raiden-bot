export const meta = {
  name:        'balance',
  aliases:     ['money'],
  version:     '1.0.2',
  type:        'anyone',
  author:      'Mirai Team',
  description: 'Check your current balance or the balance of a tagged person.',
  category:    'economy',
  guide:       ['', '@mention'],
  cooldowns:   5,
};

export async function onStart({ event, args, Currencies, response, usage }) {
  const { senderID, mentions } = event;
  const mentionIDs = Object.keys(mentions || {});

  // No args — own balance
  if (!args[0]) {
    const money = (await Currencies.getData(senderID))?.money || 0;
    return response.reply(`💰 Your current balance: ${money.toLocaleString()} coins`);
  }

  // One mention — target balance
  if (mentionIDs.length === 1) {
    const [id]  = mentionIDs;
    const money = (await Currencies.getData(id))?.money || 0;
    const name  = (mentions[id] || '').replace(/@/g, '').trim() || `User ${id}`;
    return response.reply(`💰 ${name}'s current balance: ${money.toLocaleString()} coins`);
  }

  return usage();
}
