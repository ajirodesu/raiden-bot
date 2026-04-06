export const meta = {
  name:        'work',
  aliases:     [],
  version:     '1.0.1',
  type:        'anyone',
  author:      'Mirai Team | Converted by AjiroDesu',
  description: 'Work to earn money.',
  category:    'economy',
  guide:       [''],
  cooldowns:   5,
  envConfig: {
    cooldownTime: 1200000, // 20 minutes
  },
};

const JOBS = [
  'sell lottery tickets', 'repair a car', 'programming', 'hack Facebook', 'chef',
  'mason', 'fake taxi driver', 'help someone (unusual job)', 'plumber (lucky day 😏)',
  'streamer', 'online seller', 'housewife', 'sell flowers', 'find coding jobs',
  'play Yasuo and carry your team',
];

export async function onStart({ event, response, Currencies }) {
  const { senderID } = event;
  const cooldown     = global.configModule?.work?.cooldownTime || meta.envConfig.cooldownTime;

  const userData = await Currencies.getData(senderID);
  const data     = userData?.data || {};

  if (data.workTime) {
    const remaining = cooldown - (Date.now() - data.workTime);
    if (remaining > 0) {
      const minutes = Math.floor(remaining / 60000);
      const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
      return response.reply(`⏳ Already worked today. Come back in ${minutes}m ${seconds}s.`);
    }
  }

  const job    = JOBS[Math.floor(Math.random() * JOBS.length)];
  const amount = Math.floor(Math.random() * 600);

  await Promise.all([
    Currencies.increaseMoney(senderID, amount),
    Currencies.setData(senderID, { data: { ...data, workTime: Date.now() } }),
  ]);

  return response.reply(`💼 You worked as: ${job}\n💰 You earned: $${amount}`);
}
