import axios    from "axios";
import fs       from "fs";
import request  from "request";
import moment   from "moment-timezone";

export const meta = {
  name: "sendnoti",
  version: "2.1.0",
  type: "developer",
  author: "Converted by ChatGPT",
  description: "Send announcement to all threads",
  category: "admin",
  guide: ["<message> (reply with attachment optional)"],
  cooldowns: 5
};

export async function onStart({ api, event, args, Users, usage, response }) {
  if (!args.length) return usage();

  const { threadID, senderID, type, messageReply } = event;

  const name = await Users.getNameUser(senderID);
  const time = moment.tz(global.config.TIMEZONE).format("DD/MM/YYYY || HH:mm:ss");

  const messageBody = `${args.join(" ")}\n\nFrom Admin: ${name}\nTime: ${time}`;

  const allThread    = global.data.allThreadID || [];
  let   successCount = 0;
  const failedThreads = [];

  if (type === "message_reply" && messageReply?.attachments?.length > 0) {
    try {
      const attachmentUrl = messageReply.attachments[0].url;
      const res           = await new Promise((resolve, reject) =>
        request.get(attachmentUrl, (err, r) => (err ? reject(err) : resolve(r)))
      );
      const ext      = res.request.uri.pathname.split(".").pop();
      const filePath = `${process.cwd()}/cache/snoti.${ext}`;

      const fileData = (await axios.get(attachmentUrl, { responseType: "arraybuffer" })).data;
      fs.writeFileSync(filePath, Buffer.from(fileData));

      // Broadcast to every other thread — intentionally uses api directly
      // because response is scoped only to the sender's thread.
      for (const idThread of allThread) {
        if (isNaN(parseInt(idThread)) || idThread === threadID) continue;
        try {
          await api.sendMessage(
            { body: messageBody, attachment: fs.createReadStream(filePath) },
            idThread
          );
          successCount++;
        } catch {
          failedThreads.push(idThread);
        }
        await new Promise(r => setTimeout(r, 500));
      }

      fs.unlink(filePath, () => {});
    } catch (err) {
      console.error("[SENDNOTI ERROR - ATTACHMENT]", err);
      return response.reply("❌ Failed to process attachment.");
    }
    // Broadcast to every other thread — intentionally uses api directly.
    for (const idThread of allThread) {
      if (isNaN(parseInt(idThread)) || idThread === threadID) continue;
      try {
        await api.sendMessage(messageBody, idThread);
        successCount++;
      } catch {
        failedThreads.push(idThread);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  let result = `✅ Sent message to ${successCount} thread(s).`;
  if (failedThreads.length > 0) {
    result += `\n⚠️ Failed to send to ${failedThreads.length} thread(s).`;
  }

  return response.reply(result);
}
