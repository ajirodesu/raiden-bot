import logger             from '../utils/log.js';
import { createResponse } from '../system/response.js';

/**
 * Dispatches reply events to the matching command's onReply() handler.
 */
export default function handleReply({ api, models, Users, Threads, Currencies }) {
  return async function ({ event }) {
    if (!event.messageReply) return;

    const { onReply, commands } = global.client;
    const { threadID, messageID, messageReply } = event;

    if (!onReply.length) return;

    const index = onReply.findIndex(e => e.messageID === messageReply.messageID);
    if (index < 0) return;

    const replyData = onReply[index];
    const command   = commands.get(replyData.name);

    if (!command) {
      return api.sendMessage(
        `⚠️ Could not find the command handler for this reply: "${replyData.name}".`,
        threadID, messageID,
      );
    }

    if (typeof command.onReply !== 'function') return;

    try {
      const response = createResponse(api, event);
      await command.onReply({ api, event, models, Users, Threads, Currencies, response, onReply: replyData });
    } catch (error) {
      logger.error(`[handleReply] "${replyData.name}" threw: ${error.message}`);
      api.sendMessage(
        `🔴 An error occurred in the reply handler for "${replyData.name}":\n${error.message}`,
        threadID, messageID,
      );
    }
  };
}
