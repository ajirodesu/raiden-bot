import logger from '../utils/log.js';
import { createResponse } from '../system/response.js';

/**
 * Dispatches Facebook log events (log:subscribe, log:unsubscribe, etc.)
 * to the matching event module's onEvent() handler.
 */
export default function handleEvent({ api, models, Users, Threads, Currencies }) {
  return async function ({ event }) {
    const timeStart = Date.now();
    const { userBanned, threadBanned } = global.data;
    const { events } = global.client;
    const { allowInbox, DeveloperMode } = global.config;

    let { senderID, threadID } = event;
    senderID = String(senderID);
    threadID = String(threadID);

    if (!allowInbox && senderID === threadID) return;
    if (userBanned.has(senderID) || threadBanned.has(threadID)) return;

    for (const [, eventModule] of events.entries()) {
      if (!eventModule.meta?.eventType?.includes(event.logMessageType)) continue;

      try {
        const response = createResponse(api, event);
        await eventModule.onEvent({ api, event, models, Users, Threads, Currencies, response });

        if (DeveloperMode) {
          logger(
            `Event "${eventModule.meta.name}" | thread:${threadID} | ${Date.now() - timeStart}ms`,
            '[ DEV ]',
          );
        }
      } catch (error) {
        logger(
          `Event "${eventModule.meta.name}" threw: ${error.message}`,
          'error',
        );
      }
    }
  };
}