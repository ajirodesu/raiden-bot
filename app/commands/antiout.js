export const meta = {
  name: "antiout",
  aliases: [],
  version: "1.0.0",
  type: "groupadmin",
  author: "DungUwU (Khánh Milo Fix) | Converted by AjiroDesu",
  description: "Toggle antiout protection.",
  category: "system",
  guide: ["on", "off"],
  cooldowns: 0
};

export async function onStart({ api, event, Threads, response }) {
  const { threadID } = event;

  try {
    const threadData = await Threads.get(threadID);
    const data = threadData.data || {};

    if (typeof data.antiout === "undefined" || data.antiout === false) {
      data.antiout = true;
    } else {
      data.antiout = false;
    }

    await Threads.set(threadID, { data });

    if (global.data?.threadData) {
      global.data.threadData.set(parseInt(threadID), data);
    }

    return response.reply(
      `✅ Done ${data.antiout ? "turn on" : "Turn off"} successful antiout!`
    );
  } catch (err) {
    console.error("[ANTIOUT ERROR]", err);
    return response.reply("❌ Failed to toggle antiout.");
  }
}