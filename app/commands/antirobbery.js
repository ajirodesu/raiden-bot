export const meta = {
  name: "antirobbery",
  aliases: ["antiadmin", "guard"],
  version: "1.0.0",
  type: "groupadmin",
  author: "D-Jukie | Converted by AjiroDesu",
  description: "Toggle anti-robbery protection (prevent admin changes).",
  category: "group",
  guide: [""],
  cooldowns: 0
};

export async function onStart({ api, event, Threads, response }) {
  const { threadID } = event;

  try {
    const info = await api.getThreadInfo(threadID);

    // Check bot admin permission
    if (!info.adminIDs.some(item => item.id === api.getCurrentUserID())) {
      return response.reply(
        "⚠️ Need group administrator permissions. Please add the bot as admin and try again!"
      );
    }

    // Get thread data
    const threadData = await Threads.get(threadID);
    const data = threadData.data || {};

    // Toggle guard
    if (data.guard === true || typeof data.guard === "undefined") {
      data.guard = false;
    } else {
      data.guard = true;
    }

    await Threads.set(threadID, { data });

    // Sync global cache (if your system uses it)
    if (global.data?.threadData) {
      global.data.threadData.set(parseInt(threadID), data);
    }

    return response.reply(
      `${data.guard ? "🛡️ Anti-Robbery ENABLED" : "⚠️ Anti-Robbery DISABLED"}`
    );

  } catch (err) {
    console.error("[ANTIROBBERY ERROR]", err);
    return response.reply("❌ Failed to toggle anti-robbery mode.");
  }
}