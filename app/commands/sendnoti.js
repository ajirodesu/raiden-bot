import axios   from 'axios';
import fs      from 'fs';
import moment  from 'moment-timezone';

export const meta = {
  name:        'sendnoti',
  version:     '2.2.0',
  type:        'developer',
  author:      'Converted by AjiroDesu',
  description: 'Send an announcement to all threads.',
  category:    'developer',
  guide:       ['<message> (optionally reply to a message with an attachment)'],
  cooldowns:   5,
};

const DELAY_MS = 500;
const sleep    = ms => new Promise(r => setTimeout(r, ms));

export async function onStart({ api, event, args, Users, usage, response }) {
  if (!args.length) return usage();

  const { threadID, senderID, type, messageReply } = event;

  const name        = await Users.getNameUser(senderID);
  const time        = moment.tz(global.config.TIMEZONE || 'Asia/Manila').format('DD/MM/YYYY || HH:mm:ss');
  const messageBody = `${args.join(' ')}\n\nFrom Admin: ${name}\nTime: ${time}`;

  const allThread    = global.data.allThreadID || [];
  let   successCount = 0;
  const failedIDs    = [];

  const targets = allThread.filter(id => !isNaN(parseInt(id)) && id !== threadID);

  // ── Attachment broadcast ─────────────────────────────────────────────
  if (type === 'message_reply' && messageReply?.attachments?.length > 0) {
    const attachmentUrl = messageReply.attachments[0].url;
    const ext           = attachmentUrl.split('?')[0].split('.').pop() || 'bin';
    const filePath      = `${process.cwd()}/app/cache/snoti_${Date.now()}.${ext}`;

    try {
      const fileData = (await axios.get(attachmentUrl, { responseType: 'arraybuffer' })).data;
      fs.writeFileSync(filePath, Buffer.from(fileData));

      for (const idThread of targets) {
        try {
          await api.sendMessage({ body: messageBody, attachment: fs.createReadStream(filePath) }, idThread);
          successCount++;
        } catch {
          failedIDs.push(idThread);
        }
        await sleep(DELAY_MS);
      }
    } catch (err) {
      console.error('[SENDNOTI] Attachment error:', err);
      return response.reply('🔴 Failed to process the attachment.');
    } finally {
      fs.unlink(filePath, () => {});
    }
  } else {
    // ── Text-only broadcast ────────────────────────────────────────────
    for (const idThread of targets) {
      try {
        await api.sendMessage(messageBody, idThread);
        successCount++;
      } catch {
        failedIDs.push(idThread);
      }
      await sleep(DELAY_MS);
    }
  }

  let result = `🟢 Sent to ${successCount} thread(s).`;
  if (failedIDs.length) result += `\n⚠️ Failed to send to ${failedIDs.length} thread(s).`;

  return response.reply(result);
}
