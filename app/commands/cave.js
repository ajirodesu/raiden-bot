/**
 * cave.js
 * -------
 * Explore the cave and find treasure for coins.
 * Cooldown: ~16 minutes between runs.
 */

export const meta = {
  name:        'cave',
  aliases:     ['mine', 'explore'],
  version:     '1.0.0',
  type:        'anyone',
  author:      'Huy | Converted by AjiroDesu',
  description: 'Explore the cave and sell your findings for coins.',
  category:    'economy',
  guide:       [''],
  cooldowns:   5,
  envConfig: {
    cooldownTime: 1000000, // ~16.7 minutes
  },
};

const FINDINGS = [
  'a chunk of gold ore',
  'a bag of crystals',
  'ancient coins',
  'a pile of gems',
  'raw iron deposits',
  'a rare diamond',
  'a glowing mineral',
];

export async function onStart({ event, Currencies, response }) {
  const { senderID } = event;

  const cooldownTime = global.configCmd?.cave?.cooldownTime ?? meta.envConfig.cooldownTime;

  const userData = await Currencies.getData(senderID);
  const data     = userData?.data || {};

  if (data.caveTime) {
    const remaining = cooldownTime - (Date.now() - data.caveTime);
    if (remaining > 0) {
      const minutes = Math.floor(remaining / 60000);
      const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
      return response.reply(
        `⛏️ You already explored the cave today!\nCome back in: ${minutes}m ${seconds}s.`
      );
    }
  }

  const find   = FINDINGS[Math.floor(Math.random() * FINDINGS.length)];
  const amount = Math.floor(Math.random() * 10000) + 200;

  await Promise.all([
    Currencies.increaseMoney(senderID, amount),
    Currencies.setData(senderID, { data: { ...data, caveTime: Date.now() } }),
  ]);

  return response.reply(
    `⛏️ You explored the cave and found ${find}!\n\n💰 Earned: $${amount.toLocaleString()}`
  );
}
