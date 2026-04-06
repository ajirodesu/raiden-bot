/**
 * fish.js
 * -------
 * Go fishing and earn a random amount of coins.
 * Cooldown: 10 minutes between catches.
 */

export const meta = {
  name:        'fish',
  aliases:     ['fishing'],
  version:     '1.0.0',
  type:        'anyone',
  author:      'Huy | Converted by AjiroDesu',
  description: 'Go fishing and sell your catch for coins.',
  category:    'economy',
  guide:       [''],
  cooldowns:   5,
  envConfig: {
    cooldownTime: 600000, // 10 minutes
  },
};

const FISH_TYPES = [
  'a massive tuna',
  'a golden carp',
  'a rare swordfish',
  'a giant salmon',
  'a shiny bass',
  'a big mackerel',
  'a hefty catfish',
];

export async function onStart({ event, Currencies, response }) {
  const { senderID } = event;

  const cooldownTime = global.configCmd?.fish?.cooldownTime ?? meta.envConfig.cooldownTime;

  const userData = await Currencies.getData(senderID);
  const data     = userData?.data || {};

  if (data.fishTime) {
    const remaining = cooldownTime - (Date.now() - data.fishTime);
    if (remaining > 0) {
      const minutes = Math.floor(remaining / 60000);
      const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
      return response.reply(
        `🎣 You already went fishing today!\nCome back in: ${minutes}m ${seconds}s.`
      );
    }
  }

  const catch_  = FISH_TYPES[Math.floor(Math.random() * FISH_TYPES.length)];
  const amount  = Math.floor(Math.random() * 5000) + 100;

  await Promise.all([
    Currencies.increaseMoney(senderID, amount),
    Currencies.setData(senderID, { data: { ...data, fishTime: Date.now() } }),
  ]);

  return response.reply(
    `🎣 You caught ${catch_} and sold it!\n\n💰 Earned: $${amount.toLocaleString()}`
  );
}
