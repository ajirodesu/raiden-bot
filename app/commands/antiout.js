export const meta = {
  name:        'antiout',
  aliases:     [],
  version:     '1.0.0',
  type:        'groupadmin',
  author:      'DungUwU (Khánh Milo Fix) | Converted by AjiroDesu',
  description: 'Toggle antiout protection — re-adds members who try to leave.',
  category:    'group',
  guide:       ['on', 'off'],
  cooldowns:   0,
};

export async function onStart({ event, Threads, response }) {
  const { threadID } = event;

  const threadRow = await Threads.getData(threadID);
  const data      = threadRow?.data || {};

  data.antiout = !data.antiout;

  await Threads.setData(threadID, { data });

  if (global.data?.threadData) global.data.threadData.set(String(threadID), data);

  return response.reply(
    `${data.antiout ? '🟢 Antiout ENABLED' : '🔴 Antiout DISABLED'} successfully!`,
  );
}
