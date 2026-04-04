export const meta = {
  name: "work",
  aliases: [],
  version: "1.0.1",
  type: "anyone",
  author: "Mirai Team | Converted by AjiroDesu",
  description: "Work to earn money.",
  category: "earn money",
  guide: [""],
  cooldowns: 5,
  envConfig: {
    cooldownTime: 1200000 // 20 minutes
  }
};

export async function onStart({ event, response, Currencies }) {
  const { threadID, senderID, messageID } = event;

  const cooldown = global.configModule?.work?.cooldownTime || 1200000;

  const userData = await Currencies.getData(senderID);
  const data = userData.data || {};

  // COOLDOWN CHECK
  if (data.workTime && cooldown - (Date.now() - data.workTime) > 0) {
    const time = cooldown - (Date.now() - data.workTime);
    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);

    return response.reply(
      `⏳ You have already worked today. Please come back after ${minutes} minute(s) ${seconds < 10 ? "0" + seconds : seconds} second(s).`
    );
  }

  // JOB LIST
  const jobs = [
    "sell lottery tickets",
    "repair a car",
    "programming",
    "hack Facebook",
    "chef",
    "mason",
    "fake taxi driver",
    "help someone (unusual job)",
    "plumber (lucky day 😏)",
    "streamer",
    "online seller",
    "housewife",
    "sell flowers",
    "find coding jobs",
    "play Yasuo and carry your team"
  ];

  const job = jobs[Math.floor(Math.random() * jobs.length)];
  const amount = Math.floor(Math.random() * 600);

  await Currencies.increaseMoney(senderID, amount);

  data.workTime = Date.now();
  await Currencies.setData(senderID, { data });

  return response.reply(
    `💼 You worked as: ${job}\n💰 You earned: $${amount}`
  );
}