import logger             from '../utils/log.js';
import { createResponse } from '../system/response.js';

export default function handleCommandEvent({ api, models, Users, Threads, Currencies }) {
  return async function ({ event }) {
    const { allowInbox }        = global.config;
    const { userBanned, threadBanned } = global.data;
    const { commands, eventRegistered } = global.client;

    let { senderID, threadID } = event;
    senderID = String(senderID);
    threadID = String(threadID);

    if (!allowInbox && senderID === threadID) return;
    if (userBanned.has(senderID) || threadBanned.has(threadID)) return;

    for (const cmdName of eventRegistered) {
      const cmd = commands.get(cmdName);
      if (!cmd || typeof cmd.onEvent !== 'function') continue;
      try {
        const response = createResponse(api, event);
        await cmd.onEvent({ api, event, models, Users, Threads, Currencies, response });
      } catch (error) {
        logger.error(`CommandEvent "${cmdName}": ${error.message}`);
      }
    }
  };
}
