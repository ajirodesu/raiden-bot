/**
 * calldev.js
 * ----------
 * Send a message to the bot admin(s). Admins can reply back, creating a
 * two-way conversation thread.
 *
 * Place in: app/commands/calldev.js
 */

export const meta = {
  name:        'calldev',
  aliases:     ['calladmin', 'report'],
  version:     '1.0.0',
  type:        'anyone',
  author:      'NTKhang | Converted for Raiden by AjiroDesu',
  description: 'Send a report, feedback, or bug report to the bot admin(s).',
  category:    'utility',
  guide:       ['<message>'],
  cooldowns:   5,
};

export async function onStart({ api, event, args, Users, response, usage }) {
  const { senderID, threadID, isGroup } = event;
  const ADMINBOT = global.config.ADMINBOT || [];

  if (!args[0])        return usage();
  if (!ADMINBOT.length) return response.reply('⚠️ The bot has no admins configured.');

  const senderName    = await Users.getNameUser(senderID);
  const locationLine  = isGroup
    ? `\n- Sent from group thread: ${threadID}`
    : '\n- Sent from a private message';

  const formBody =
    `==📨 CALL DEV 📨==` +
    `\n- User: ${senderName}` +
    `\n- User ID: ${senderID}` +
    locationLine +
    `\n\nMessage:\n─────────────────\n${args.join(' ')}\n─────────────────` +
    `\nReply to this message to respond to the user.`;

  const successCount = [];
  const failedCount  = [];

  for (const adminID of ADMINBOT) {
    try {
      const info = await new Promise((resolve, reject) =>
        api.sendMessage(formBody, adminID, (err, res) => (err ? reject(err) : resolve(res)))
      );

      successCount.push(adminID);

      global.client.onReply.push({
        name:            meta.name,
        messageID:       info.messageID,
        userThreadID:    threadID,
        originMessageID: event.messageID,
        type:            'userCallDev',
        senderID:        String(senderID),
      });
    } catch {
      failedCount.push(adminID);
    }
  }

  let msg = '';
  if (successCount.length) msg += `✅ Message sent to ${successCount.length} admin(s) successfully!`;
  if (failedCount.length)  msg += `\n❌ Could not reach ${failedCount.length} admin(s).`;
  return response.reply(msg.trim());
}

export async function onReply({ api, event, args, Users, response, onReply: replyData }) {
  const { senderID, threadID } = event;
  const { type, userThreadID, originMessageID, senderID: originalSenderID } = replyData;
  const senderName = await Users.getNameUser(senderID);

  // ── Admin replies to user ─────────────────────────────────────────────
  if (type === 'userCallDev') {
    if (!args[0]) return response.reply('⚠️ Please type your reply message.');

    const replyBody =
      `📍 Reply from admin ${senderName}:\n─────────────────\n${args.join(' ')}\n─────────────────` +
      `\nReply to this message to continue the conversation.`;

    let info;
    try {
      info = await new Promise((resolve, reject) =>
        api.sendMessage(replyBody, userThreadID, (err, res) => (err ? reject(err) : resolve(res)), originMessageID)
      );
    } catch (err) {
      return response.reply(`❌ Failed to send reply: ${err.message}`);
    }

    response.reply('✅ Reply sent to user successfully!');

    global.client.onReply.push({
      name:            meta.name,
      messageID:       info.messageID,
      adminThreadID:   threadID,
      originMessageID: event.messageID,
      type:            'adminReply',
    });
    return;
  }

  // ── User replies back to admin ────────────────────────────────────────
  if (type === 'adminReply') {
    if (!args[0]) return response.reply('⚠️ Please type your reply message.');

    const { adminThreadID } = replyData;

    const feedbackBody =
      `📝 Follow-up from user ${senderName} (ID: ${senderID}):\n─────────────────\n${args.join(' ')}\n─────────────────` +
      `\nReply to this message to continue.`;

    let info;
    try {
      info = await new Promise((resolve, reject) =>
        api.sendMessage(feedbackBody, adminThreadID, (err, res) => (err ? reject(err) : resolve(res)), originMessageID)
      );
    } catch (err) {
      return response.reply(`❌ Failed to send your reply: ${err.message}`);
    }

    response.reply('✅ Your reply was sent to the admin!');

    global.client.onReply.push({
      name:            meta.name,
      messageID:       info.messageID,
      userThreadID:    threadID,
      originMessageID: event.messageID,
      type:            'userCallDev',
      senderID:        String(senderID),
    });
  }
}
