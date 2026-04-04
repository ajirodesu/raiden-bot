import axios    from "axios";
import fs       from "fs";
import path     from "path";
import { pipeline } from "stream/promises";

export const meta = {
  name: "shoti",
  version: "3.3.0",
  type: "anyone",
  author: "AjiroDesu",
  description: "Fetch a random shoti video.",
  category: "media",
  guide: [],
  cooldowns: 10
};

export async function onStart({ api, event, response }) {
  const cacheDir = path.join("app", "cache");
  const tmpPath  = path.join(cacheDir, `shoti_${Date.now()}.mp4`);

  try {
    fs.mkdirSync(cacheDir, { recursive: true });

    const apiRes = await axios.get(`${api.betadash}/shoti`);
    const data   = apiRes?.data?.result;

    if (!data?.shotiurl) {
      return response.reply("❌ No video received from the API. Please try again.");
    }

    const videoStream = await axios.get(data.shotiurl, { responseType: "stream" });
    await pipeline(videoStream.data, fs.createWriteStream(tmpPath));

    await response.reply({
      body:
        `🎬 SHOTI REPLAY\n\n` +
        `Author : ${data.author    || "N/A"}\n` +
        `Title  : ${data.title     || "N/A"}\n` +
        `User   : @${data.username || "N/A"}\n` +
        `Nick   : ${data.nickname  || "N/A"}\n` +
        `Time   : ${data.duration  ?? 0}s\n` +
        `Region : ${data.region    || "Unknown"}\n` +
        `Total  : ${data.total_vids ?? "N/A"}`,
      attachment: fs.createReadStream(tmpPath)
    });

    fs.unlink(tmpPath, (err) => {
      if (err) console.error("[SHOTI] Failed to delete temp file:", err);
    });
  } catch (error) {
    console.error("[SHOTI ERROR]", error);
    return response.reply("❌ Failed to fetch shoti video. Please try again later.");
  }
}
