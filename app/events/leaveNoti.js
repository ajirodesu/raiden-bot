export const meta = {
  name:        'leaveNoti',
  version:     '1.0.0',
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

  // Ignore bot leaving
  if (leftID === api.getCurrentUserID()) return;

  const row  = await Threads.getData(threadID);
  const data = row?.data || {};
  if (data.leaveNoti === false) return;

  const name   = global.data.userName.get(String(leftID)) || await Users.getNameUser(String(leftID));
  const isSelf = author === leftID;
  const type   = isSelf ? 'left the group' : 'was removed by an admin';

  const threadData  = global.data.threadData.get(String(threadID)) || {};
  const customMsg   = threadData.customLeave;

  let body = customMsg ||
    `👋 {name} has {type}.\nWe'll miss you!`;

  body = body
    .replace(/\{name}/g, name)
    .replace(/\{type}/g, type);

  const gifUrl = FAREWELL_GIFS[Math.floor(Math.random() * FAREWELL_GIFS.length)];

  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const request = require('request');
    const fs      = require('fs-extra');
    const path    = require('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const cachePath = path.join(__dirname, '../cache/leave_tmp.gif');

    request(encodeURI(gifUrl)).pipe(fs.createWriteStream(cachePath)).on('close', () => {
      response.send(
        { body, attachment: fs.createReadStream(cachePath) },
        threadID,
      ).finally(() => {
        try { fs.unlinkSync(cachePath); } catch { /* ignore */ }
      });
    });
  } catch {
    // Fallback: send text only if GIF download fails
    response.send(body, threadID);
  }
}