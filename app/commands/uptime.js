export const meta = {
  name:        'uptime',
  aliases:     ['up'],
  version:     '1.0.0',
  type:        'anyone',       // anyone | groupadmin | premium | developer
  author:      'AjiroDesu',
  description: 'Check how long the bot has been running (uptime).',
  category:    'system',
  guide:       [''],
  cooldowns:   5,
};

export async function onStart({ api, event, response }) {
  const { senderID } = event;

  // ── Get actual user name using stfca (the Facebook Chat API client) ─────
  let userName = 'Master'; // fallback
  try {
    const userInfo = await new Promise((resolve) => {
      api.getUserInfo(senderID, (err, data) => {
        resolve(err || !data?.[senderID] ? {} : data[senderID]);
      });
    });
    if (userInfo?.name) userName = userInfo.name;
  } catch (e) {
    // silent fallback
  }

  // ── Calculate uptime ───────────────────────────────────────────────────
  const uptimeSeconds = process.uptime();

  const days    = Math.floor(uptimeSeconds / 86400);
  const hours   = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  const parts = [];
  if (days > 0)    parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0)   parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (seconds > 0 || parts.length === 0) 
    parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

  const timeString = parts.length > 1
    ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]
    : parts[0] || '0 seconds';

  const message = `Greetings Master ${userName}, I've been running for ${timeString}.`;

  return response.reply(message);
}