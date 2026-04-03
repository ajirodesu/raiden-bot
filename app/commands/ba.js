import axios from "axios";

export const meta = {
  name: "bluearchive",
  version: "1.0.0",
  type: "anyone",
  author: "AjiroDesu",
  description: "Get a random Blue Archive character image.",
  category: "anime",
  guide: [],
  cooldowns: 5
};

export async function onStart({ api, event }) {
  const { threadID, messageID } = event;
  const imageUrl = `${global.endpoint.ajiro}/anime/ba`;

  try {
    const imageStream = await axios.get(imageUrl, { responseType: "stream" });

    return api.sendMessage(
      {
        body: "💙 Random Blue Archive Image",
        attachment: imageStream.data
      },
      threadID,
      messageID
    );
  } catch (error) {
    console.error("[BA ERROR]", error);
    return api.sendMessage(
      "❌ Failed to fetch Blue Archive image. Please try again later.",
      threadID,
      messageID
    );
  }
}