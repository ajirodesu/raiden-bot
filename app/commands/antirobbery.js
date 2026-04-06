export const meta = {
  name:        'antirobbery',
  aliases:     ['antiadmin', 'guard'],
  version:     '1.0.0',
  type:        'groupadmin',
  author:      'D-Jukie | Converted by AjiroDesu',
  description: 'Toggle anti-robbery protection (prevent unauthorized admin changes).',
  category:    'group',
  guide:       [''],
  cooldowns:   0,
};

export async function onStart({ api, event, Threads, response }) {
  const { threadID } = event;

  const info = await api.getThreadInfo(threadID);
  if (!info.adminIDs.some(item => item.id === api.getCurrentUserID())) {
    return response.reply(
      '⚠️ Need group administrator permissions. Please add the bot as admin and try again!',
    );
  }

  const threadRow = await Threads.getData(threadID);
  const data      = threadRow?.data || {};

  data.guard = !data.guard;

  await Threads.setData(threadID, { data });

  if (global.data?.threadData) global.data.threadData.set(String(threadID), data);

  return response.reply(
    data.guard ? '🟢 Anti-Robbery ENABLED' : '🔴 Anti-Robbery DISABLED',
  );
}
