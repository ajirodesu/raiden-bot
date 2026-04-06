/**
 * warnJoin.js  (EVENT FILE)
 * -------------------------
 * Companion to warn.js.
 * When a member who has 3+ warnings tries to rejoin the group,
 * they are automatically kicked and the group is notified.
 *
 * Place in: app/events/warnJoin.js
 */

export const meta = {
  name:        'warnJoin',
  version:     '1.0.0',
  author:      'NTKhang | Converted for Raiden by AjiroDesu',
  description: 'Auto-kick banned members (3+ warns) who try to rejoin the group.',
  eventType:   ['log:subscribe'],
};

export async function onEvent({ api, event, Threads, Users, response }) {
  const { threadID, logMessageData } = event;
  const tID               = String(threadID);
  const addedParticipants = logMessageData?.addedParticipants || [];

  if (!addedParticipants.length) return;

  // Load warn data from DB
  const row      = await Threads.getData(tID);
  const warnList = row?.data?.warn || [];
  if (!warnList.length) return;

  const botID      = String(api.getCurrentUserID());
  let   threadInfo;
  try { threadInfo = await api.getThreadInfo(tID); } catch { return; }

  const adminIDs   = (threadInfo?.adminIDs || []).map(a => String(a.id));
  const botIsAdmin = adminIDs.includes(botID);

  const toKick = [];
  for (const participant of addedParticipants) {
    const uid = String(participant.userFbId);
    if (uid === botID) continue;

    const entry = warnList.find(u => String(u.uid) === uid);
    if (!entry || entry.list.length < 3) continue;

    const name = participant.fullName
      || global.data.userName.get(uid)
      || await Users.getNameUser(uid);

    toKick.push({ uid, name });
  }

  if (!toKick.length) return;

  const nameList = toKick.map(u => `• ${u.name} (${u.uid})`).join('\n');
  await response.send(
    `⚠️ The following member(s) attempted to rejoin but are currently banned (3+ warnings):\n${nameList}`,
    tID
  );

  if (!botIsAdmin) {
    return response.send(
      '⚠️ I need group admin permissions to remove banned members. Please make me an admin.',
      tID
    );
  }

  const failed = [];
  for (const { uid, name } of toKick) {
    try {
      await new Promise((resolve, reject) =>
        api.removeUserFromGroup(uid, tID, err => (err ? reject(err) : resolve()))
      );
    } catch {
      failed.push(name);
    }
    await new Promise(r => setTimeout(r, 600));
  }

  if (failed.length) {
    response.send(
      `⚠️ Failed to remove: ${failed.join(', ')}`,
      tID
    );
  }
}
