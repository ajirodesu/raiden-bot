/**
 * antijoin.js (command) — Toggle Anti-Join Protection
 *
 * Usage:
 *   +antijoin        → toggles between ON and OFF
 *   +antijoin on     → explicitly enable
 *   +antijoin off    → explicitly disable
 *
 * When ON, the antijoin EVENT automatically kicks every new member that
 * joins the group. Turn it OFF before adding members intentionally.
 *
 * The setting is stored per-thread under data.newMember (true = ON).
 */

// ── Meta ──────────────────────────────────────────────────────────────────
export const meta = {
  name:        'antijoin',
  aliases:     ['joinprotect', 'blockjoin'],
  version:     '1.0.0',
  type:        'groupadmin',
  author:      'D-Jukie',
  description: 'Toggle Anti-Join protection. When ON, all new members are automatically kicked.',
  category:    'group',
  guide:       ['', 'on', 'off'],
  cooldowns:   3,
};

// ── onStart ───────────────────────────────────────────────────────────────
export async function onStart({ event, args, Threads, response }) {
  const threadID = String(event.threadID);

  // ── Load current setting ─────────────────────────────────────────────
  let data = {};
  try {
    const row = await Threads.getData(threadID);
    data = (row && row.data) ? row.data : {};
  } catch (e) {
    return response.reply(`❌ Failed to load thread data: ${e.message}`);
  }

  // ── Resolve desired state ────────────────────────────────────────────
  const arg = (args[0] || '').toLowerCase();

  if (arg === 'on') {
    data.newMember = true;
  } else if (arg === 'off') {
    data.newMember = false;
  } else {
    // Toggle
    data.newMember = !data.newMember;
  }

  // ── Persist to DB + in-memory cache ──────────────────────────────────
  try {
    await Threads.setData(threadID, { data });
    if (global.data?.threadData) {
      global.data.threadData.set(threadID, data);
    }
  } catch (e) {
    return response.reply(`❌ Failed to save setting: ${e.message}`);
  }

  // ── Respond ──────────────────────────────────────────────────────────
  if (data.newMember) {
    return response.reply(
      '🔒 Anti-Join ENABLED!\n\n' +
      '» Every new member who joins will be automatically kicked.\n' +
      '» Turn this OFF before adding members on purpose.\n\n' +
      `Use ${global.config?.PREFIX || '+'}antijoin off to disable.`,
    );
  } else {
    return response.reply(
      '🔓 Anti-Join DISABLED.\n\n' +
      '» New members are now allowed to join freely.',
    );
  }
}