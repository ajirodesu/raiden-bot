export const meta = {
  name:        'daily',
  version:     '1.0.2',
  type:        'anyone',
  author:      'Mirai Team',
  description: 'Claim your daily reward of coins once every 12 hours!',
  category:    'economy',
  guide:       [],
  cooldowns:   5,
  envConfig: {
    cooldownTime: 43200000,
    rewardCoin:   19011310000,
  },
};

export async function onStart({ event, Currencies, response }) {
  const { senderID } = event;
  const { daily }    = global.configCmd;
  const cooldownTime = daily?.cooldownTime ?? meta.envConfig.cooldownTime;
  const rewardCoin   = daily?.rewardCoin   ?? meta.envConfig.rewardCoin;

  const userData    = (await Currencies.getData(senderID))?.data || {};
  const remaining   = cooldownTime - (Date.now() - (userData.dailyCoolDown || 0));

  if (remaining > 0) {
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    return response.reply(
      `⏳ Daily reward already claimed!\n\nCome back in: ${h}h ${m}m ${String(s).padStart(2, '0')}s.`,
    );
  }

  await Promise.all([
    Currencies.increaseMoney(senderID, rewardCoin),
    Currencies.setData(senderID, { data: { ...userData, dailyCoolDown: Date.now() } }),
  ]);

  return response.reply(
    `🟢 Daily reward claimed!\n\nYou received ${rewardCoin.toLocaleString()} coins.\nCome back in 12 hours!`,
  );
}
