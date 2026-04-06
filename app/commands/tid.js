export const meta = {
  name:        'tid',
  aliases:     ['gid'],
  version:     '1.2',
  type:        'anyone',
  author:      'AjiroDesu',
  description: 'View threadID of your group chat',
  category:    'group',
  guide:       [''],
  cooldowns:   5,
};

export async function onStart({ event, response }) {
  return response.reply(event.threadID.toString());
}