import axios    from "axios";
import fs       from "fs";
import path     from "path";
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

export async function onStart({ event, response }) {
  const apiUrl = `${global.endpoint.ajiro}/random/cosplay`;

  try {
    const { data } = await axios.get(apiUrl);

    if (!data?.videoUrl) {
      return response.reply("❌ No video received from the API. Please try again.");
    }

    const tmpPath   = path.join("app/cache", `cosplay_${Date.now()}.mp4`);
    const videoStream = await axios.get(data.videoUrl, { responseType: "stream" });

    await pipeline(videoStream.data, fs.createWriteStream(tmpPath));

    await response.reply({
      body: "🎥 Random Cosplay Video\n\nEnjoy! 💃",
      attachment: fs.createReadStream(tmpPath)
    });

    fs.unlink(tmpPath, (err) => {
      if (err) console.error("[COSPLAY] Failed to delete temp file:", err);
    });
  } catch (error) {
    console.error("[COSPLAY ERROR]", error);
    return response.reply("❌ Failed to fetch cosplay video. Please try again later.");
  }
}
