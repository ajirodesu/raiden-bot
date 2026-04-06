import axios    from 'axios';
import fs       from 'fs-extra';
import path     from 'path';
import { fileURLToPath } from 'url';
import { pipeline }       from 'stream/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '../cache');

export const meta = {
  name:        'leaveNoti',
  version:     '1.1.0',
  author:      'AjiroDesu',
  description: 'Sends a farewell message when a member leaves the group.',
  eventType:   ['log:unsubscribe'],
};

const FAREWELL_GIFS = [
  'https://i.postimg.cc/zXm63C7W/sad-wave-crying.gif',
  'https://i.postimg.cc/q7mW7WDM/89fa2fcbc20ec4c71ecd3c63141ef4ff.gif',
];

export async function onEvent({ api, event, Users, Threads, response }) {
  const { threadID, logMessageData, author } = event;
  const leftID = logMessageData.leftParticipantFbId;

  if (leftID === api.getCurrentUserID()) return;

  const threadRow = await Threads.getData(threadID);
  const data      = threadRow?.data || {};
  if (data.leaveNoti === false) return;

  const name   = global.data.userName.get(String(leftID)) || await Users.getNameUser(String(leftID));
  const isSelf = author === leftID;
  const type   = isSelf ? 'left the group' : 'was removed by an admin';

  const threadData = global.data.threadData.get(String(threadID)) || {};
  const customMsg  = threadData.customLeave;

  const body = (customMsg || '👋 {name} has {type}.\nWe\'ll miss you!')
    .replace(/\{name}/g, name)
    .replace(/\{type}/g, type);

  const gifUrl   = FAREWELL_GIFS[Math.floor(Math.random() * FAREWELL_GIFS.length)];
  const ext      = gifUrl.split('.').pop();
  const tmpPath  = path.join(CACHE_DIR, `leave_${Date.now()}.${ext}`);

  try {
    await fs.ensureDir(CACHE_DIR);
    const gifStream = await axios.get(encodeURI(gifUrl), { responseType: 'stream' });
    await pipeline(gifStream.data, fs.createWriteStream(tmpPath));

    await response.send({ body, attachment: fs.createReadStream(tmpPath) }, threadID);
  } catch {
    // GIF failed — send text-only fallback
    await response.send(body, threadID);
  } finally {
    fs.remove(tmpPath).catch(() => {});
  }
}
