/**
 * anonymous.js
 * ------------
 * Send messages through the bot without revealing the caller's identity.
 * Available to premium users and developers.
 *
 * The command is listed as type "hidden" so it never appears in +help,
 * keeping its existence invisible to ordinary users.
 *
 * Sub-commands:
 *
 *   +anon <message>
 *       Post <message> in the current thread as the bot.
 *       The caller's trigger message is unsent by the bot immediately
 *       after sending — leaving only the anonymous message behind.
 *
 *   +anon to <threadID> <message>
 *       Post <message> in a different thread.
 *       Useful for developers moderating groups they are not visibly in.
 *
 *   +anon reply <message>          (used as a reply to another message)
 *       The bot quotes the target message and responds anonymously.
 *
 * Identity protection layers:
 *   1. The bot sends the message — no attribution to the caller.
 *   2. The caller's own command message is unsent by the bot right away
 *      (works because the bot has message-management rights in the thread).
 *   3. No ⏳ / 🟢 reactions are placed on the caller's message so there is
 *      no visual indicator that a privileged user triggered anything.
 *   4. The command is hidden from +help entirely.
 *
 * Place in: app/commands/anonymous.js
 */

export const meta = {
  name:        'ghost',
  aliases:     [],
  version:     '1.0.0',
  type:        'premium',        // accessible by premium AND developer users
  author:      'AjiroDesu',
  description: 'Send messages through the bot anonymously.',
  category:    'premium',         // never appears in +help
  guide: [
    '<message>                   – post anonymously in this thread',
    'to <threadID> <message>     – post anonymously in another thread',
    'reply <message>             – anonymous reply (use as a message reply)',
  ],
  cooldowns: 3,
};

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Try to unsend the caller's trigger message so no trace is left.
 * Silently ignores failures (bot not admin, already unsent, etc.)
 */
async function eraseTrigger(api, messageID) {
  try {
    await new Promise((resolve, reject) =>
      api.unsendMessage(messageID, err => (err ? reject(err) : resolve()))
    );
  } catch { /* caller keeps their message — not fatal */ }
}

/**
 * Send a plain message and return the info object.
 */
function sendMessage(api, text, threadID, replyToID) {
  return new Promise((resolve, reject) => {
    const cb = (err, info) => (err ? reject(err) : resolve(info));
    if (replyToID) {
      api.sendMessage({ body: text }, threadID, cb, replyToID);
    } else {
      api.sendMessage(text, threadID, cb);
    }
  });
}

// ── Command ───────────────────────────────────────────────────────────────

export async function onStart({ api, event, args, response, usage }) {
  const { threadID, messageID, messageReply } = event;

  if (!args.length) {
    // Show usage only to the caller — reply privately then unsend trigger
    await usage();
    // Erase the +anon command that prompted this so nobody sees the help text trigger
    await eraseTrigger(api, messageID);
    return;
  }

  const sub = args[0].toLowerCase();

  // ── anon reply ──────────────────────────────────────────────────────
  if (sub === 'reply') {
    const text = args.slice(1).join(' ').trim();
    if (!text) {
      await response.reply('⚠️ Please provide a message to send.');
      await eraseTrigger(api, messageID);
      return;
    }

    if (!messageReply) {
      await response.reply('⚠️ Use this as a reply to another message to quote it.');
      await eraseTrigger(api, messageID);
      return;
    }

    // Erase caller's trigger first, then send anon reply
    await eraseTrigger(api, messageID);
    await sendMessage(api, text, threadID, messageReply.messageID);
    return;
  }

  // ── anon to <threadID> ───────────────────────────────────────────────
  if (sub === 'to') {
    const targetThread = args[1];
    const text         = args.slice(2).join(' ').trim();

    if (!targetThread || isNaN(targetThread)) {
      await response.reply('⚠️ Please provide a valid thread ID.\n\nUsage: +anon to <threadID> <message>');
      await eraseTrigger(api, messageID);
      return;
    }
    if (!text) {
      await response.reply('⚠️ Please provide a message to send.');
      await eraseTrigger(api, messageID);
      return;
    }

    await eraseTrigger(api, messageID);

    try {
      await sendMessage(api, text, targetThread);
    } catch (err) {
      // Can't erase the error reply — but the trigger is already gone
      await sendMessage(api, `❌ Failed to send to thread ${targetThread}: ${err.message}`, threadID);
    }
    return;
  }

  // ── anon (current thread) ────────────────────────────────────────────
  const text = args.join(' ').trim();
  if (!text) return;

  // Erase trigger before sending so the anonymous message appears without
  // the command above it
  await eraseTrigger(api, messageID);
  await sendMessage(api, text, threadID);
}
