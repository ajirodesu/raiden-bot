export const meta = {
  name: "balance",
  aliases: ["money"],
  version: "1.0.2",
  type: "anyone",
  author: "Mirai Team",
  description: "Check your current balance or the balance of the tagged person",
  category: "economy",
  guide: [],
  cooldowns: 5
};

export async function onStart({ event, args, Currencies, response }) {
  const { senderID, mentions } = event;

  // No args — show own balance
  if (!args[0]) {
    const money = (await Currencies.getData(senderID)).money || 0;
    return response.reply(`💰 Your current balance: ${money.toLocaleString()} coins`);
  }

  // One mention — show that user's balance
  if (Object.keys(mentions).length === 1) {
    const mention = Object.keys(mentions)[0];
    const money   = (await Currencies.getData(mention)).money || 0;
    const name    = mentions[mention].replace(/@/g, "");

    return response.reply(`💰 ${name}'s current balance: ${money.toLocaleString()} coins`);
  }

  // Invalid usage
  return global.utils.throwError("balance", event.threadID, event.messageID);
}
