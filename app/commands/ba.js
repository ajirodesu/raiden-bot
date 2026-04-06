import axios from 'axios';

export const meta = {
  name:        'bluearchive',
  aliases:     ['ba'],
  version:     '1.0.0',
  type:        'anyone',
  author:      'AjiroDesu',
  description: 'Get a random Blue Archive character image.',
  category:    'anime',
  guide:       [],
  cooldowns:   5,
};

export async function onStart({ event, response }) {
  try {
    const imageStream = await axios.get(`${global.endpoint.ajiro}/anime/ba`, { responseType: 'stream' });
    return response.reply({ body: '💙 Random Blue Archive Image', attachment: imageStream.data });
  } catch (error) {
    return response.reply('🔴 Failed to fetch Blue Archive image. Please try again later.');
  }
}
