/**
 * kick.js
 * -------
 * Remove tagged members from the group. Requires group admin permission.
 */

export const meta = {
  name:        'kick',
  aliases:     ['remove'],
  version:     '1.0.1',
  type:        'groupadmin',
  author:      'Mirai Team | Converted by AjiroDesu',
  description: 'Remove tagged members from the group.',
  category:    'group',
  guide:       ['@mention'],
  cooldowns:   0,
};

export async function onStart({ api, event, Threads, response }) {
  const { threadID, messageID, senderID, mentions } = event;

  const mentionIDs = Object.keys(mentions || {});

  if (!mentionIDs.length) {
    return response.reply('⚠️ You need to tag at least one person to kick.');
  }

  let threadData;
  try {
    threadData = (await Threads.getData(threadID))?.threadInfo;
  } catch {
    return response.reply('❌ Could not load group data. Please try again.');
  }

  const botID    = String(api.getCurrentUserID());
  const adminIDs = (threadData?.adminIDs || []).map(a => String(a.id));

  if (!adminIDs.includes(botID)) {
    return response.reply('⚠️ I need group admin permissions to kick members.\nPlease make me an admin and try again.');
  }

  const callerIsAdmin = adminIDs.includes(String(senderID));
  if (!callerIsAdmin) {
    return response.reply('⚠️ Only group admins can use this command.');
  }

  const results = [];

  for (const uid of mentionIDs) {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await api.removeUserFromGroup(uid, threadID);
      results.push(`✅ Kicked ${mentions[uid] || uid}`);
    } catch (err) {
      results.push(`❌ Failed to kick ${mentions[uid] || uid}: ${err.message}`);
    }
  }

  return response.reply(results.join('\n'));
}
