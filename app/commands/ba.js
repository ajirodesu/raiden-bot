import axios from "axios";

export const meta = {
  name: "bluearchive",
  aliases: ["ba"],
  version: "1.0.0",
  type: "anyone",
  author: "AjiroDesu",
  description: "Get a random Blue Archive character image.",
  category: "anime",
  guide: [],
  cooldowns: 5
};

export async function onStart({ event, response }) {
  const imageUrl = `${global.endpoint.ajiro}/anime/ba`;

  try {
    const imageStream = await axios.get(imageUrl, { responseType: "stream" });
    return response.reply({
      body: "💙 Random Blue Archive Image",
      attachment: imageStream.data
    });
  } catch (error) {
    console.error("[BA ERROR]", error);
    return response.reply("❌ Failed to fetch Blue Archive image. Please try again later.");
  }
}
