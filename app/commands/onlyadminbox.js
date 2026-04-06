/**
 * onlyadminbox.js
 * ---------------
 * Toggle "Only Admin Box" mode per group. When enabled for a thread, only
 * group admins can trigger commands — regular members get a silent ⚠️ reaction.
 *
 * Optionally toggle the ⚠️ notification with the "noti" sub-command.
 *
 * Data stored in thread's DB `data` column:
 *   data.onlyAdminBox       true/false — whether restriction is active
 *   data.onlyAdminBoxNoti   true/false — whether to show the ⚠️ reaction (default true)
 *
 * Enforcement logic lives in core/handle/handleCommand.js.
 *
 * Place in: app/commands/onlyadminbox.js
 */

export const meta = {
  name:        'onlyadminbox',
  aliases:     ['onlyadbox', 'adboxonly', 'adminboxonly'],
  version:     '1.0.0',
  type:        'groupadmin',
  author:      'NTKhang | Converted for Raiden by AjiroDesu',
  description: 'Restrict bot usage in this group to group admins only. Non-admins receive a ⚠️ reaction.',
  category:    'group',
  guide: [
    'on           – enable (only group admins can use the bot here)',
    'off          – disable (everyone can use the bot here)',
    'noti on      – show ⚠️ reaction when a non-admin tries to use bot (default)',
    'noti off     – silently ignore non-admin commands (no reaction)',
    'status       – show current settings for this group',
  ],
  cooldowns: 5,
};

// ── DB helpers ──────────────────────────────────────────────────────────────

async function getThreadData(Threads, threadID) {
  const row  = await Threads.getData(String(threadID));
  return row?.data || {};
}

async function saveThreadData(Threads, threadID, data) {
  await Threads.setData(String(threadID), { data });
  global.data.threadData.set(String(threadID), data);
}

// ── Command ──────────────────────────────────────────────────────────────────

export async function onStart({ event, args, Threads, response, usage }) {
  const { threadID } = event;
  const tID          = String(threadID);

  if (!args[0]) return usage();

  const sub = args[0].toLowerCase();

  // ── status ────────────────────────────────────────────────────────────
  if (sub === 'status') {
    const data      = await getThreadData(Threads, tID);
    const enabled   = data.onlyAdminBox ? '🔒 ON' : '🔓 OFF';
    const notiState = data.onlyAdminBoxNoti === false ? 'Silent (no ⚠️)' : 'Active (shows ⚠️)';
    return response.reply(
      `Only Admin Box:\n• Status: ${enabled}\n• Reaction notification: ${notiState}`
    );
  }

  // ── noti on/off ───────────────────────────────────────────────────────
  if (sub === 'noti') {
    const notiSub = (args[1] || '').toLowerCase();
    if (notiSub !== 'on' && notiSub !== 'off') return usage();

    const notiValue = notiSub === 'on';
    const data      = await getThreadData(Threads, tID);
    data.onlyAdminBoxNoti = notiValue;
    await saveThreadData(Threads, tID, data);

    return response.reply(
      notiValue
        ? '✅ Reaction notification enabled — non-admins will receive a ⚠️ when blocked.'
        : '✅ Reaction notification disabled — non-admin commands will be silently ignored.'
    );
  }

  // ── on / off ──────────────────────────────────────────────────────────
  if (sub !== 'on' && sub !== 'off') return usage();

  const value = sub === 'on';
  const data  = await getThreadData(Threads, tID);

  data.onlyAdminBox = value;
  // Default noti to true if not previously set
  if (data.onlyAdminBoxNoti === undefined) data.onlyAdminBoxNoti = true;
  await saveThreadData(Threads, tID, data);

  return response.reply(
    value
      ? '🔒 Only Admin Box mode is ON.\nOnly group admins can use the bot in this group. Others receive a ⚠️ reaction.'
      : '🔓 Only Admin Box mode is OFF.\nAll members can use the bot normally.'
  );
}
