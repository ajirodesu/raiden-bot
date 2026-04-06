/**
 * busy.js
 * -------
 * Do-Not-Disturb mode. When a busy user is @mentioned, the bot notifies
 * the sender. Busy status is stored in the user's `data` column in the DB.
 *
 * Place in: app/commands/busy.js
 */

export const meta = {
  name:        'busy',
  aliases:     ['dnd', 'donotdisturb'],
  version:     '1.0.0',
  type:        'anyone',
  author:      'NTKhang | Converted for Raiden by AjiroDesu',
  description: 'Toggle Do Not Disturb mode. The bot will notify others when they mention you.',
  category:    'utility',
  guide: [
    '           – turn on DND (no reason)',
    '<reason>   – turn on DND with a reason',
    'off        – turn off DND',
  ],
  cooldowns: 5,
};

export async function onStart({ event, args, Users, response }) {
  const { senderID } = event;
  const uID          = String(senderID);

  // ── Turn off ──────────────────────────────────────────────────────────
  if (args[0] === 'off') {
    const row  = await Users.getData(uID);
    const data = row?.data || {};
    delete data.busy;
    await Users.setData(uID, { data });
    return response.reply('✅ Do Not Disturb mode has been turned off.');
  }

  // ── Turn on ───────────────────────────────────────────────────────────
  const reason = args.join(' ').trim();
  const row    = await Users.getData(uID);
  const data   = row?.data || {};

  data.busy = reason || true;   // true = busy, no reason; string = busy with reason
  await Users.setData(uID, { data });

  return response.reply(
    reason
      ? `✅ Do Not Disturb mode enabled.\nReason: ${reason}`
      : '✅ Do Not Disturb mode enabled. You will be notified when someone mentions you.'
  );
}

// ── onEvent: intercept @mentions and check if the tagged user is busy ────────

export async function onEvent({ event, Users, response }) {
  if (!event.body || !event.mentions) return;

  const mentionIDs = Object.keys(event.mentions);
  if (!mentionIDs.length) return;

  for (const userID of mentionIDs) {
    try {
      const row      = await Users.getData(String(userID));
      const busyData = row?.data?.busy;

      if (busyData === undefined || busyData === null || busyData === false) continue;

      const displayName = (event.mentions[userID] || '').replace(/@/g, '').trim() || `User ${userID}`;

      if (typeof busyData === 'string' && busyData.length > 0) {
        return response.reply(`⚠️ ${displayName} is currently busy.\nReason: ${busyData}`);
      } else {
        return response.reply(`⚠️ ${displayName} is currently busy.`);
      }
    } catch {
      // Skip users with no DB entry yet
    }
  }
}
