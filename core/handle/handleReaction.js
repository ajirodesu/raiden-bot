import { createResponse } from '../system/response.js';

/**
 * Dispatches reaction events to the matching command's onReaction() handler.
 */
export default function handleReaction({ api, models, Users, Threads, Currencies }) {
  return async function ({ event }) {
    const { onReaction, commands } = global.client;
    const { messageID, threadID }  = event;

    if (!onReaction.length) return;

    const index = onReaction.findIndex(e => e.messageID === messageID);
    if (index < 0) return;

    const reactionData = onReaction[index];
    const command      = commands.get(reactionData.name);

    if (!command) {
      return api.sendMessage(
        `⚠️ Could not find the command handler for this reaction: "${reactionData.name}".`,
        threadID,
        messageID,
      );
    }

    if (typeof command.onReaction !== 'function') return;

    try {
      const response = createResponse(api, event);
      await command.onReaction({
        api,
        event,
        models,
        Users,
        Threads,
        Currencies,
        response,
        onReaction: reactionData,
      });
    } catch (error) {
      console.error(`[handleReaction] "${reactionData.name}" threw:`, error);
      api.sendMessage(
        `⚠️ An error occurred in the reaction handler for "${reactionData.name}":\n${error.message}`,
        threadID,
        messageID,
      );
    }
  };
}