import logger from '../utils/log.js';

/**
 * Automatically creates database entries for new threads and users on message.
 */
export default function handleCreateDatabase({ Users, Threads, Currencies }) {
  return async function ({ event }) {
    const { allUserID, allCurrenciesID, allThreadID, userName, threadInfo } = global.data;

    if (global.config.autoCreateDB === false) return;

    let { senderID, threadID } = event;
    senderID = String(senderID);
    threadID = String(threadID);

    try {
      // ── New group thread ──────────────────────────────────────────────
      if (!allThreadID.includes(threadID) && event.isGroup) {
        const threadIn4  = await Threads.getInfo(threadID);
        const dataThread = {
          threadName: threadIn4.threadName,
          adminIDs:   threadIn4.adminIDs,
          nicknames:  threadIn4.nicknames,
        };

        allThreadID.push(threadID);
        threadInfo.set(threadID, dataThread);
        await Threads.setData(threadID, { threadInfo: dataThread, data: {} });

        for (const member of (threadIn4.userInfo || [])) {
          const memberID = String(member.id);
          userName.set(memberID, member.name);
          if (!allUserID.includes(memberID)) {
            await Users.createData(memberID, { name: member.name, data: {} });
            allUserID.push(memberID);
            logger(`New user registered: ${member.name} (${memberID})`, 'USER');
          }
        }
        logger(`New thread registered: ${threadIn4.threadName} (${threadID})`, 'THREAD');
      }

      // ── New or updated user ───────────────────────────────────────────
      if (!allUserID.includes(senderID) || !userName.has(senderID)) {
        const info = await Users.getInfo(senderID);
        await Users.createData(senderID, { name: info.name });
        allUserID.push(senderID);
        userName.set(senderID, info.name);
        logger(`New user registered: ${info.name} (${senderID})`, 'USER');
      }

      // ── New currencies row ────────────────────────────────────────────
      if (!allCurrenciesID.includes(senderID)) {
        await Currencies.createData(senderID, { data: {} });
        allCurrenciesID.push(senderID);
      }

    } catch (err) {
      logger.error(`handleCreateDatabase: ${err.message || err}`);
    }
  };
}
