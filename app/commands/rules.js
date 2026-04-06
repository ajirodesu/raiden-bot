/**
 * rules.js
 * --------
 * Create, view, edit, reorder, and delete group rules.
 * Rules are stored in the thread's `data.rules` array in the DB.
 *
 * Place in: app/commands/rules.js
 */

// ── DB helpers ──────────────────────────────────────────────────────────────

async function getRules(Threads, threadID) {
  const row  = await Threads.getData(String(threadID));
  return row?.data?.rules || [];
}

async function saveRules(Threads, threadID, rules) {
  const row  = await Threads.getData(String(threadID));
  const data = row?.data || {};
  data.rules = rules;
  await Threads.setData(String(threadID), { data });
  global.data.threadData.set(String(threadID), data);
}

// ── Command ──────────────────────────────────────────────────────────────────

export const meta = {
  name:        'rules',
  aliases:     ['rule'],
  version:     '1.0.0',
  type:        'anyone',
  author:      'NTKhang | Converted for Raiden by AjiroDesu',
  description: 'View, add, edit, reorder, and delete group rules.',
  category:    'group',
  guide: [
    '                  – view all rules',
    '<n>               – view rule number n',
    'add <text>        – add a new rule (admin only)',
    'edit <n> <text>   – edit rule number n (admin only)',
    'move <n1> <n2>    – swap rules n1 and n2 (admin only)',
    'del <n>           – delete rule number n (admin only)',
    'reset             – delete all rules (admin only)',
  ],
  cooldowns: 5,
};

export async function onStart({ event, args, Threads, response, permission, usage }) {
  const { threadID, senderID } = event;
  const tID     = String(threadID);
  const isAdmin = permission >= 1;
  const prefix  = global.data.threadData.get(tID)?.PREFIX || global.config.PREFIX || '/';

  const type  = args[0];
  const rules = await getRules(Threads, tID);
  const total = rules.length;

  // ── No sub-command: view all rules ───────────────────────────────────
  if (!type) {
    if (!total)
      return response.reply(
        `This group has no rules yet.\nAdmins can add them with \`${prefix}rules add <text>\`.`
      );

    const ruleText = rules.map((r, i) => `${i + 1}. ${r}`).join('\n');
    const info = await response.reply(`📋 Group Rules:\n${ruleText}\n\nReply with a number to view a specific rule.`);

    response.addReply({
      messageID:     info.messageID,
      name:          meta.name,
      author:        String(senderID),
      rulesSnapshot: [...rules],
      type:          'viewSingle',
    });
    return;
  }

  // ── add ───────────────────────────────────────────────────────────────
  if (['add', '-a'].includes(type)) {
    if (!isAdmin) return response.reply('⚠️ Only group admins can add rules.');
    if (!args[1]) return response.reply('⚠️ Please enter the text for the new rule.');

    rules.push(args.slice(1).join(' '));
    await saveRules(Threads, tID, rules);
    return response.reply(`✅ Rule #${rules.length} added successfully.`);
  }

  // ── edit ──────────────────────────────────────────────────────────────
  if (['edit', '-e'].includes(type)) {
    if (!isAdmin) return response.reply('⚠️ Only group admins can edit rules.');
    const n = parseInt(args[1]);
    if (isNaN(n) || n < 1) return response.reply('⚠️ Please enter a valid rule number to edit.');
    if (!rules[n - 1]) return response.reply(`⚠️ Rule #${n} does not exist. This group has ${total} rule(s).`);
    if (!args[2])      return response.reply(`⚠️ Please enter the new text for rule #${n}.`);

    const newText  = args.slice(2).join(' ');
    rules[n - 1]   = newText;
    await saveRules(Threads, tID, rules);
    return response.reply(`✅ Rule #${n} updated:\n${newText}`);
  }

  // ── move ──────────────────────────────────────────────────────────────
  if (['move', '-m'].includes(type)) {
    if (!isAdmin) return response.reply('⚠️ Only group admins can reorder rules.');
    const n1 = parseInt(args[1]);
    const n2 = parseInt(args[2]);
    if (isNaN(n1) || isNaN(n2)) return response.reply('⚠️ Please enter two valid rule numbers to swap.');
    if (n1 === n2) return response.reply('⚠️ You cannot swap a rule with itself.');
    if (!rules[n1 - 1] || !rules[n2 - 1])
      return response.reply(`⚠️ One or both rule numbers are out of range. This group has ${total} rule(s).`);

    [rules[n1 - 1], rules[n2 - 1]] = [rules[n2 - 1], rules[n1 - 1]];
    await saveRules(Threads, tID, rules);
    return response.reply(`✅ Rules #${n1} and #${n2} have been swapped.`);
  }

  // ── delete ────────────────────────────────────────────────────────────
  if (['delete', 'del', '-d'].includes(type)) {
    if (!isAdmin) return response.reply('⚠️ Only group admins can delete rules.');
    const n = parseInt(args[1]);
    if (isNaN(n) || n < 1) return response.reply('⚠️ Please enter a valid rule number to delete.');
    if (!rules[n - 1]) return response.reply(`⚠️ Rule #${n} does not exist. This group has ${total} rule(s).`);

    const [deleted] = rules.splice(n - 1, 1);
    await saveRules(Threads, tID, rules);
    return response.reply(`✅ Rule #${n} deleted:\n"${deleted}"`);
  }

  // ── reset ─────────────────────────────────────────────────────────────
  if (['reset', 'remove', '-r', '-rm'].includes(type)) {
    if (!isAdmin) return response.reply('⚠️ Only group admins can clear all rules.');

    const info = await response.reply('⚠️ React to this message to confirm clearing ALL rules for this group.');
    response.addReaction({
      messageID: info.messageID,
      name:      meta.name,
      author:    String(senderID),
      type:      'confirmReset',
    });
    return;
  }

  // ── View by number: /rules 2 ─────────────────────────────────────────
  if (!isNaN(type)) {
    const lines = [];
    for (const stt of args) {
      const n = parseInt(stt);
      if (!isNaN(n) && rules[n - 1]) lines.push(`${n}. ${rules[n - 1]}`);
    }
    if (!lines.length)
      return response.reply(`⚠️ Rule #${type} does not exist. This group has ${total} rule(s).`);
    return response.reply(lines.join('\n'));
  }

  return usage();
}

// ── onReply: user types a number to view a specific rule ────────────────────

export async function onReply({ event, response, onReply: replyData }) {
  const { author, rulesSnapshot, type } = replyData;
  if (type !== 'viewSingle') return;
  if (String(event.senderID) !== String(author)) return;

  const n     = parseInt(event.body || '');
  const total = rulesSnapshot.length;

  if (isNaN(n) || n < 1) return response.reply('⚠️ Please reply with a valid rule number.');
  if (n > total)          return response.reply(`⚠️ Rule #${n} does not exist. This group has ${total} rule(s).`);

  return response.reply(`${n}. ${rulesSnapshot[n - 1]}`);
}

// ── onReaction: confirm clearing all rules ───────────────────────────────────

export async function onReaction({ event, Threads, response, onReaction: reactionData }) {
  const { author, type } = reactionData;
  if (type !== 'confirmReset') return;
  if (String(event.userID) !== String(author)) return;

  await saveRules(Threads, event.threadID, []);
  return response.reply('✅ All group rules have been cleared.');
}
