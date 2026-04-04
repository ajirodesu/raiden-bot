export const meta = {
  name: "daily",
  version: "1.0.2",
  type: "anyone",
  author: "Mirai Team",
  description: "Claim your daily reward of coins once every 12 hours!",
  category: "economy",
  guide: [],
  cooldowns: 5,
  envConfig: {
    cooldownTime: 43200000,
    rewardCoin: 19011310000
  }
};

export async function onStart({ event, Currencies, response }) {
  const { daily }     = global.configCmd;
  const cooldownTime  = daily.cooldownTime;
  const rewardCoin    = daily.rewardCoin;
  const { senderID }  = event;

  const userData = (await Currencies.getData(senderID)).data || {};
  const remaining = cooldownTime - (Date.now() - (userData.dailyCoolDown || 0));

  if (remaining > 0) {
    const hours   = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining / (1000 * 60)) % 60);
    const seconds = Math.floor((remaining / 1000) % 60);

    return response.reply(
      `⏳ Daily reward already claimed!\n\nPlease come back after: ` +
      `${hours}h ${minutes}m ${String(seconds).padStart(2, "0")}s.`
    );
  }

  // Claim reward
  await response.reply(
    `🎉 Daily reward claimed successfully!\n\n` +
    `You received ${rewardCoin.toLocaleString()} coins.\n\n` +
    `Come back in 12 hours for your next reward!`
  );

  await Currencies.increaseMoney(senderID, rewardCoin);
  userData.dailyCoolDown = Date.now();
  await Currencies.setData(senderID, { data: userData });
}
