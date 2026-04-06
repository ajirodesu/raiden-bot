import axios    from 'axios';
import fs       from 'fs';
import path     from 'path';
import { pipeline } from 'stream/promises';

export const meta = {
  name:        'cosplay',
  version:     '1.0.0',
  type:        'anyone',
  author:      'AjiroDesu',
  description: 'Get a random cosplay video.',
  category:    'anime',
  guide:       [],
  cooldowns:   5,
};

export async function onStart({ response }) {
  const { data } = await axios.get(`${global.endpoint.ajiro}/random/cosplay`).catch(() => ({ data: null }));

  if (!data?.videoUrl) {
    return response.reply('🔴 No video received from the API. Please try again.');
  }

  const tmpPath = path.join('app/cache', `cosplay_${Date.now()}.mp4`);
  try {
    const videoStream = await axios.get(data.videoUrl, { responseType: 'stream' });
    await pipeline(videoStream.data, fs.createWriteStream(tmpPath));
    await response.reply({ body: '🎥 Random Cosplay Video\n\nEnjoy! 💃', attachment: fs.createReadStream(tmpPath) });
  } catch {
    return response.reply('🔴 Failed to fetch cosplay video. Please try again later.');
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}
