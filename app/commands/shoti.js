import axios from "axios";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";

export const meta = {
  name: "shoti",
  version: "1.0.0",
  type: "anyone",
  author: "AjiroDesu",
  description: "Get a random Shoti video.",
  category: "media",
  guide: [],
  cooldowns: 5
};

export async function onStart({ response }) {
  const apiUrl = 'https://betadash-shoti-yazky.vercel.app/shotizxx?apikey=shipazu';

  try {
    const { data } = await axios.get(apiUrl);

    if (!data?.shotiurl) {
      return response.reply("❌ No video received from the API. Please try again.");
    }

    const tmpPath = path.join("app/cache", `shoti_${Date.now()}.mp4`);
    const videoStream = await axios.get(data.shotiurl, { responseType: "stream" });

    await pipeline(videoStream.data, fs.createWriteStream(tmpPath));

    const message =
`🎥 Shoti Video

👤 Author: ${data.author}
📛 Username: ${data.username}
📝 Nickname: ${data.nickname}
🏷 Title: ${data.title}
🌍 Region: ${data.region}
⏱ Duration: ${data.duration}s
🎞 Total Videos: ${data.total_vids}`;

    await response.reply({
      body: message,
      attachment: fs.createReadStream(tmpPath)
    });

    fs.unlink(tmpPath, () => {});
  } catch (error) {
    console.error("[SHOTI ERROR]", error);
    return response.reply("❌ Failed to fetch shoti video. Please try again later.");
  }
}