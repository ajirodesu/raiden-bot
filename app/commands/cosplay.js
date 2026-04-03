import axios from "axios";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";

export const meta = {
  name: "cosplay",
  version: "1.0.0",
  type: "anyone",
  author: "AjiroDesu",
  description: "Get a random cosplay video.",
  category: "anime",
  guide: [],
  cooldowns: 5
};

export async function onStart({ api, event }) {
  const { threadID, messageID } = event;
  const apiUrl = `${global.endpoint.ajiro}/random/cosplay`;

  try {
    const response = await axios.get(apiUrl);
    const data = response.data;

    if (!data || !data.videoUrl) {
      return api.sendMessage(
        "❌ No video received from the API. Please try again.",
        threadID,
        messageID
      );
    }

    // Download video to a temp file
    const tmpPath = path.join("app/cache", `cosplay_${Date.now()}.mp4`);
    const videoStream = await axios.get(data.videoUrl, { responseType: "stream" });

    await pipeline(videoStream.data, fs.createWriteStream(tmpPath));

    // Send the video from the temp file
    await api.sendMessage(
      {
        body: "🎥 Random Cosplay Video\n\nEnjoy! 💃",
        attachment: fs.createReadStream(tmpPath)
      },
      threadID,
      messageID
    );

    // Clean up temp file after sending
    fs.unlink(tmpPath, (err) => {
      if (err) console.error("[COSPLAY] Failed to delete temp file:", err);
    });

  } catch (error) {
    console.error("[COSPLAY ERROR]", error);
    return api.sendMessage(
      "❌ Failed to fetch cosplay video. Please try again later.",
      threadID,
      messageID
    );
  }
}
