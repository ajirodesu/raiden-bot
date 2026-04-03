import logger from '../utils/log.js';
import chalk from 'chalk';

const COLORS = [
  'FF9900','FFFF33','33FFFF','FF99FF','FF3366','FFFF66','00CCFF',
  'FF0099','7ED957','97FFFF','00BFFF','76EEC6','4EEE94','AFD788',
];

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

/**
 * Automatically creates database entries for new threads and users.
 */
export default function handleCreateDatabase({ Users, Threads, Currencies, models }) {
  return async function ({ event }) {
    const { allUserID, allCurrenciesID, allThreadID, userName, threadInfo } = global.data;
    const { autoCreateDB } = global.config;

    if (autoCreateDB === false) return;

    let { senderID, threadID } = event;
    senderID = String(senderID);
    threadID = String(threadID);

    try {
      // ── New group thread ──────────────────────────────────────────────
      if (!allThreadID.includes(threadID) && event.isGroup) {
        const threadIn4 = await Threads.getInfo(threadID);
        const dataThread = {
          threadName: threadIn4.threadName,
          adminIDs:   threadIn4.adminIDs,
          nicknames:  threadIn4.nicknames,
        };

        allThreadID.push(threadID);
        threadInfo.set(threadID, dataThread);

        await Threads.setData(threadID, { threadInfo: dataThread, data: {} });

        // Register each member in the group
        for (const member of (threadIn4.userInfo || [])) {
          const memberID = String(member.id);
          userName.set(memberID, member.name);
          try {
            if (!global.data.allUserID.includes(memberID)) {
              await Users.createData(memberID, { name: member.name, data: {} });
              global.data.allUserID.push(memberID);
              const c = randomColor();
              logger(
                chalk.hex(`#${c}`)(`New user: ${member.name}`) + ` || ${memberID}`,
                '[ USER ]',
              );
            }
          } catch (e) {
            console.error('[handleCreateDatabase] member insert error:', e.message);
          }
        }

        const c = randomColor();
        logger(
          chalk.hex(`#${c}`)(`New group: ${threadID}`) + ` || ${threadIn4.threadName}`,
          '[ THREAD ]',
        );
      }

      // ── New or updated user ───────────────────────────────────────────
      if (!allUserID.includes(senderID) || !userName.has(senderID)) {
        const info = await Users.getInfo(senderID);
        await Users.createData(senderID, { name: info.name });
        allUserID.push(senderID);
        userName.set(senderID, info.name);
        const c = randomColor();
        logger(
          chalk.hex(`#${c}`)(`New user: ${info.name}`) + ` || ${senderID}`,
          '[ USER ]',
        );
      }

      // ── New currencies row ────────────────────────────────────────────
      if (!allCurrenciesID.includes(senderID)) {
        await Currencies.createData(senderID, { data: {} });
        allCurrenciesID.push(senderID);
      }

    } catch (err) {
      console.error('[handleCreateDatabase]', err.message || err);
    }
  };
}