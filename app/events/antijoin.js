/**
 * antijoin.js (event) — Auto-kick new members when Anti-Join is ON
 *
 * Listens for `log:subscribe` events (someone joining the group).
 * If the thread has `data.newMember === true`, every newly-joined user
 * (except the bot itself) is removed and the group is notified.
 *
 * Toggle with the `antijoin` command.
 *
 * Original logic by D-Jukie — converted to Raiden ESM format.
 */

// ── Meta ──────────────────────────────────────────────────────────────────
export const meta = {
  name:        'antijoin',
  version:     '1.0.0',
  author:      'D-Jukie',
  description: 'Automatically removes new members when Anti-Join mode is enabled.',
  category:    'events',
  eventType:   ['log:subscribe'],
};

// ── onEvent ───────────────────────────────────────────────────────────────
export async function onEvent({ event, api, Threads }) {
  const threadID = String(event.threadID);
  const botID    = String(api.getCurrentUserID());

  // ── Load thread data ─────────────────────────────────────────────────
  let data = {};
  try {
    const row = await Threads.getData(threadID);
    data = (row && row.data) ? row.data : {};
  } catch {
    return;
  }

  // Anti-join is off — do nothing
  if (!data.newMember) return;

  // If the bot itself is being added, don't self-kick
  const participants = event.logMessageData?.addedParticipants || [];
  if (participants.some(p => String(p.userFbId) === botID)) return;

  // ── Kick each newly-joined member ────────────────────────────────────
  const toKick = participants.map(p => String(p.userFbId));

  for (const userID of toKick) {
    // Small delay between kicks to avoid rate-limiting
    await new Promise(resolve => setTimeout(resolve, 1000));

    await new Promise(resolve => {
      api.removeUserFromGroup(userID, threadID, async (err) => {
        if (err) {
          // If removal fails (e.g. bot lost admin), disable anti-join
          // so the thread isn't stuck in a broken state
          data.newMember = false;
          try {
            await Threads.setData(threadID, { data });
            if (global.data?.threadData) {
              global.data.threadData.set(threadID, data);
            }
          } catch { /* non-fatal */ }
        }
        resolve();
      });
    });
  }

  // Notify the group (only if anti-join is still enabled after all kicks)
  if (data.newMember) {
    api.sendMessage(
      `» Your team has Anti-Join mode turned on.\n` +
      `Please turn it off before adding a new 👻 member.`,
      threadID,
    );
  }
}