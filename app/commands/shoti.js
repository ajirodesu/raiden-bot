import axios    from 'axios';
import fs       from 'fs';
import path     from 'path';
import { pipeline } from 'stream/promises';

export const meta = {
  name:        'shoti',
  version:     '1.0.0',
  type:        'anyone',
  author:      'AjiroDesu',
  description: 'Get a random Shoti video.',
  category:    'media',
  guide:       [],
  cooldowns:   5,
};

const API_URL = 'https://betadash-shoti-yazky.vercel.app/shotizxx?apikey=shipazu';

export async function onStart({ response }) {
  const { data } = await axios.get(API_URL).catch(() => ({ data: null }));

  if (!data?.shotiurl) {
    return response.reply('🔴 No video received from the API. Please try again.');
  }

  const tmpPath = path.join('app/cache', `shoti_${Date.now()}.mp4`);
  try {
    const videoStream = await axios.get(data.shotiurl, { responseType: 'stream' });
    await pipeline(videoStream.data, fs.createWriteStream(tmpPath));

    await response.reply({
      body: `🎥 Shoti Video\n\n👤 Author: ${data.author}\n📛 Username: ${data.username}\n📝 Nickname: ${data.nickname}\n🏷 Title: ${data.title}\n🌍 Region: ${data.region}\n⏱ Duration: ${data.duration}s\n🎞 Total Videos: ${data.total_vids}`,
      attachment: fs.createReadStream(tmpPath),
    });
  } catch {
    return response.reply('🔴 Failed to fetch shoti video. Please try again later.');
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}
