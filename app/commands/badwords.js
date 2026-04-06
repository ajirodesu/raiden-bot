/**
 * badwords.js
 * -----------
 * Per-group bad-word filter. First violation = warning, second = kick.
 * Data is stored directly in the thread's existing `data` column in the DB.
 *
 * Place in: app/commands/badwords.js
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function maskWord(str) {
  if (str.length <= 2) return str[0] + '*';
  return str[0] + '*'.repeat(str.length - 2) + str[str.length - 1];
}

async function getThreadData(Threads, threadID) {
  const row  = await Threads.getData(String(threadID));
  return row?.data || {};
}

async function saveThreadData(Threads, threadID, data) {
  await Threads.setData(String(threadID), { data });
  // Keep in-memory cache in sync
  global.data.threadData.set(String(threadID), data);
}

// ── Command ──────────────────────────────────────────────────────────────────

export const meta = {
  name:        'badwords',
  aliases:     ['badword', 'bw'],
  version:     '1.0.0',
  type:        'anyone',
  author:      'NTKhang | Converted for Raiden by AjiroDesu',
  description: 'Toggle bad-word filtering and manage banned words per group. 2nd offence = kick.',
  category:    'group',
  guide: [
    'on                  – enable filtering',
    'off                 – disable filtering',
    'add <word(s)>       – add banned words (separate with , or |)',
    'del <word(s)>       – remove banned words',
    'list [hide]         – show banned words (use "hide" to mask them)',
    'unwarn @tag|uid     – remove one violation from a member',
  ],
  cooldowns: 5,
};

export async function onStart({ api, event, args, Threads, Users, response, permission, usage }) {
  const { threadID, senderID } = event;
  const isAdmin = permission >= 1;
  const tID     = String(threadID);

  if (!args[0]) return usage();

  const data     = await getThreadData(Threads, tID);
  const badWords = data.badWords || { words: [], violations: {}, enabled: false };

  switch (args[0]) {

    case 'on': {
      if (!isAdmin) return response.reply('⚠️ Only group admins can enable this feature.');
      badWords.enabled = true;
      data.badWords    = badWords;
      await saveThreadData(Threads, tID, data);
      return response.reply('✅ Bad-word filtering has been enabled for this group.');
    }

    case 'off': {
      if (!isAdmin) return response.reply('⚠️ Only group admins can disable this feature.');
      badWords.enabled = false;
      data.badWords    = badWords;
      await saveThreadData(Threads, tID, data);
      return response.reply('✅ Bad-word filtering has been disabled for this group.');
    }

    case 'add': {
      if (!isAdmin)  return response.reply('⚠️ Only group admins can add banned words.');
      if (!args[1])  return response.reply('⚠️ Please enter at least one word to ban.');

      const words     = args.slice(1).join(' ').split(/[,|]/).map(w => w.trim()).filter(Boolean);
      const added     = [];
      const duplicate = [];
      const tooShort  = [];

      for (const word of words) {
        if (word.length < 2)               { tooShort.push(word);  continue; }
        if (badWords.words.includes(word)) { duplicate.push(word); continue; }
        badWords.words.push(word);
        added.push(word);
      }

      data.badWords = badWords;
      await saveThreadData(Threads, tID, data);

      const lines = [];
      if (added.length)     lines.push(`✅ Added ${added.length} word(s) to the filter.`);
      if (duplicate.length) lines.push(`❌ Already in list: ${duplicate.map(maskWord).join(', ')}`);
      if (tooShort.length)  lines.push(`⚠️ Too short (min 2 chars): ${tooShort.join(', ')}`);
      return response.reply(lines.join('\n'));
    }

    case 'delete':
    case 'del':
    case '-d': {
      if (!isAdmin)  return response.reply('⚠️ Only group admins can remove banned words.');
      if (!args[1])  return response.reply('⚠️ Please enter at least one word to remove.');

      const words    = args.slice(1).join(' ').split(/[,|]/).map(w => w.trim()).filter(Boolean);
      const removed  = [];
      const notFound = [];

      for (const word of words) {
        const idx = badWords.words.indexOf(word);
        if (idx !== -1) { badWords.words.splice(idx, 1); removed.push(word); }
        else              notFound.push(word);
      }

      data.badWords = badWords;
      await saveThreadData(Threads, tID, data);

      const lines = [];
      if (removed.length)  lines.push(`✅ Removed ${removed.length} word(s).`);
      if (notFound.length) lines.push(`❌ Not found: ${notFound.join(', ')}`);
      return response.reply(lines.join('\n'));
    }

    case 'list':
    case 'all': {
      if (!badWords.words.length)
        return response.reply('⚠️ The banned-word list for this group is empty.');

      const display = args[1] === 'hide'
        ? badWords.words.map(maskWord).join(', ')
        : badWords.words.join(', ');

      return response.reply(`📑 Banned words in this group:\n${display}`);
    }

    case 'unwarn': {
      if (!isAdmin) return response.reply('⚠️ Only group admins can remove violations.');

      const targetID = String(
        Object.keys(event.mentions || {})[0]
        || event.messageReply?.senderID
        || args[1]
        || ''
      );

      if (!targetID || isNaN(targetID))
        return response.reply('⚠️ Please tag or enter the user ID to remove a violation from.');

      const violations = badWords.violations || {};
      if (!violations[targetID] || violations[targetID] <= 0)
        return response.reply(`⚠️ That user has no active violations.`);

      violations[targetID]--;
      if (violations[targetID] === 0) delete violations[targetID];
      badWords.violations = violations;
      data.badWords       = badWords;
      await saveThreadData(Threads, tID, data);

      const name = await Users.getNameUser(targetID);
      return response.reply(`✅ Removed 1 violation from ${name} (${targetID}).`);
    }

    default:
      return usage();
  }
}

// ── onEvent: scan every message for banned words ─────────────────────────────

export async function onEvent({ api, event, Threads, response }) {
  if (!event.body) return;

  const { threadID, senderID, body } = event;
  const tID      = String(threadID);
  const sID      = String(senderID);
  const ADMINBOT = global.config.ADMINBOT || [];

  if (ADMINBOT.includes(sID)) return;

  // Skip if the message is itself a badwords command
  const activePrefix = global.data.threadData.get(tID)?.PREFIX || global.config.PREFIX || '/';
  const cmdNames     = [meta.name, ...(meta.aliases || [])];
  if (cmdNames.some(n => body.toLowerCase().startsWith(`${activePrefix}${n}`))) return;

  const data     = await getThreadData(Threads, tID);
  const badWords = data.badWords;

  if (!badWords?.enabled || !badWords.words?.length) return;

  const violations = badWords.violations || {};

  for (const word of badWords.words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`\\b${escaped}\\b`, 'gi').test(body)) continue;

    const strikes = violations[sID] || 0;

    if (strikes < 1) {
      violations[sID]     = strikes + 1;
      badWords.violations = violations;
      data.badWords       = badWords;
      await Threads.setData(tID, { data });
      global.data.threadData.set(tID, data);

      return response.reply(
        `⚠️ Banned word detected in your message.\n` +
        `This is your warning — one more violation will get you kicked.`
      );
    } else {
      violations[sID]     = strikes + 1;
      badWords.violations = violations;
      data.badWords       = badWords;
      await Threads.setData(tID, { data });
      global.data.threadData.set(tID, data);

      await response.reply(`⚠️ You have been removed from the group for repeated bad-word violations.`);
      api.removeUserFromGroup(sID, tID, (err) => {
        if (err) response.reply('⚠️ Failed to kick — please give me admin permissions.');
      });
      return;
    }
  }
}
