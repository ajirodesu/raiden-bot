import logger              from '../utils/log.js';
import { createResponse }  from '../system/response.js';
import { createRequire }   from 'module';
import { Groq }            from 'groq-sdk';

const require          = createRequire(import.meta.url);
const stringSimilarity = require('string-similarity');

const PERMISSION_LEVEL = {
  anyone:     0,
  groupadmin: 1,
  premium:    2,
  developer:  3,
};

const PERMISSION_LABEL = ['anyone', 'group admin', 'premium user', 'developer'];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Command visibility / permission check (synced with help.js) ───────
function isCommandVisible(command, senderID, threadID) {
  const m = command.meta || {};
  if (String(m.category || '').toLowerCase() === 'hidden') return false;

  const reqType = (m.type || 'anyone').toLowerCase();
  const userID  = String(senderID);
  const config  = global.config || {};

  const isDev     = Array.isArray(config.ADMINBOT) && config.ADMINBOT.includes(userID);
  const isPremium = Array.isArray(config.PREMIUM) && config.PREMIUM.includes(userID);

  let isGroupAdmin = false;
  try {
    const tID = parseInt(threadID);
    const info = global.data.threadInfo?.get(tID) || global.data.threadInfo?.get(threadID);
    if (info && Array.isArray(info.adminIDs)) {
      isGroupAdmin = info.adminIDs.some(a => String(a.id) === userID);
    }
  } catch {}

  if (reqType === 'anyone')     return true;
  if (reqType === 'groupadmin') return isGroupAdmin || isDev;
  if (reqType === 'premium')    return isPremium || isDev;
  if (reqType === 'developer')  return isDev;

  return false;
}

/**
 * Handles incoming messages.
 *  - Bot name mentioned anywhere  → Groq AI mode (no prefix needed)
 *  - Prefix at start              → Normal command mode
 */
export default function handleCommand({ api, models, Users, Threads, Currencies }) {

  // ── Groq AI client (lazy-init) ────────────────────────────────────────
  const groqApiKey = global.config.GROQ_API_KEY || process.env.GROQ_API_KEY;
  const groqClient = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

  return async function ({ event }) {
    const dateNow = Date.now();
    const { allowInbox, PREFIX, ADMINBOT, DeveloperMode, BOTNAME } = global.config;
    const { userBanned, threadBanned, threadData, commandBanned }  = global.data;
    const { commands, cooldowns }                                   = global.client;

    let { body, senderID, threadID, messageID } = event;
    senderID = String(senderID);
    threadID = String(threadID);

    if (!body) return;
    if (!allowInbox && senderID === threadID) return;

    // ── AI trigger (bot name mention, no prefix required) ────────────────
    const botName      = BOTNAME || 'Raiden';
    const isAIMention  = body.toLowerCase().includes(botName.toLowerCase());

    // ── Prefix detection ─────────────────────────────────────────────────
    const threadSetting = threadData.get(threadID) || {};
    const activePrefix  = threadSetting.PREFIX || PREFIX;
    const prefixRegex   = new RegExp(`^(<@!?${senderID}>|${escapeRegex(activePrefix)})\\s*`);
    const hasPrefixCmd  = prefixRegex.test(body);

    if (!isAIMention && !hasPrefixCmd) return;

    // ── Universal ban checks ─────────────────────────────────────────────
    if (!ADMINBOT.includes(senderID)) {
      if (userBanned.has(senderID)) {
        const { reason, dateAdded } = userBanned.get(senderID);
        return _bannedReply(api, `❌ You are banned.\nReason: ${reason}\nDate: ${dateAdded}`, threadID, messageID);
      }
      if (threadBanned.has(threadID)) {
        const { reason, dateAdded } = threadBanned.get(threadID);
        return _bannedReply(api, `❌ This group is banned.\nReason: ${reason}\nDate: ${dateAdded}`, threadID, messageID);
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // AI MODE
    // ════════════════════════════════════════════════════════════════════
    if (isAIMention) {
      if (!groqClient) {
        return api.sendMessage('❌ AI is not configured (missing GROQ_API_KEY).', threadID, messageID);
      }

      let userName = `User ${senderID}`;
      try {
        const userInfo = await new Promise((res) => {
          api.getUserInfo(senderID, (err, data) => res(err || !data?.[senderID] ? {} : data[senderID]));
        });
        if (userInfo.name) userName = userInfo.name;
      } catch {}

      const dev = global.config.DEVELOPER || {};
      const developerInfo = `${dev.NAME || 'Unknown'} (ID: ${dev.ID || 'N/A'}, Link: ${dev.LINK || 'N/A'})`;

      const availableCommands = [...commands.keys()].join(', ');

      const systemPrompt =
        `You are a helpful AI assistant inside a Messenger bot named "${botName}".\n` +
        `Your developer / creator / owner is: ${developerInfo}\n` +
        `Current user: ${userName} (ID: ${senderID})\n` +
        `Available commands: ${availableCommands}\n\n` +
        `Rules:\n` +
        `- If the current user ID exactly matches your developer's ID (${dev.ID || 'N/A'}), you are talking to your own developer. Be extra friendly, respectful, and helpful.\n` +
        `- If the user asks about your developer, creator, owner, who made you, or who owns the bot, always answer using the exact information above.\n` +
        `- If the user asks to run a bot command, respond ONLY with valid JSON:\n` +
        `  {"action":"execute_command","commandName":"exact_name","args":["arg1"]}\n` +
        `- Otherwise, reply naturally and helpfully.`;

      let aiText = '';
      try {
        const completion = await groqClient.chat.completions.create({
          model:       'llama-3.3-70b-versatile',
          messages:    [{ role: 'system', content: systemPrompt }, { role: 'user', content: body }],
          temperature: 0.7,
          max_tokens:  1200,
        });
        aiText = completion.choices[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";
      } catch (aiErr) {
        logger.error(`Groq API: ${aiErr.message}`);
        return api.sendMessage('❌ AI service temporarily unavailable.', threadID, messageID);
      }

      const cleaned = aiText.replace(/```(?:json)?|```/g, '').trim();
      let execCmd = null, execArgs = [];
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.action === 'execute_command' && typeof parsed.commandName === 'string' && Array.isArray(parsed.args)) {
          execCmd  = parsed.commandName.toLowerCase().trim();
          execArgs = parsed.args.map(a => String(a).trim());
        }
      } catch {}

      if (execCmd) {
        return await _executeCommand({
          api, event, models, Users, Threads, Currencies, commands, cooldowns,
          commandName: execCmd, args: execArgs, senderID, threadID, messageID,
          ADMINBOT, PERMISSION_LEVEL, PERMISSION_LABEL, dateNow, DeveloperMode, aiMode: true,
        });
      }

      return api.sendMessage(aiText, threadID, messageID);
    }

    // ════════════════════════════════════════════════════════════════════
    // NORMAL PREFIX COMMAND MODE
    // ════════════════════════════════════════════════════════════════════
    const [matchedPrefix] = body.match(prefixRegex);
    const argsFull        = body.slice(matchedPrefix.length).trim().split(/\s+/);
    const commandName     = argsFull.shift()?.toLowerCase() || '';
    const args            = argsFull;

    // ── NEW: Special response when ONLY the prefix is typed (no command) ─────
    if (!commandName) {
      return api.sendMessage(
        `🟢 System Online.\nType ${activePrefix}help to see commands.`,
        threadID,
        messageID
      );
    }

    let command = commands.get(commandName);

    // Support aliases (exact match)
    if (!command) {
      for (const [, cmd] of commands.entries()) {
        if ((cmd.meta?.aliases || []).some(a => String(a).toLowerCase() === commandName)) {
          command = cmd;
          break;
        }
      }
    }

    if (!command) {
      const allNames = [...commands.keys()];
      if (!allNames.length) return;
      const best = stringSimilarity.findBestMatch(commandName, allNames).bestMatch;
      if (best.rating >= 0.5) {
        command = commands.get(best.target);
      } else {
        return api.sendMessage(
          `❓ Command "${commandName}" not found.\n` +
          (best.rating >= 0.3
            ? `Did you mean: ${activePrefix}${best.target}?\n\n`
            : '') +
          `Type ${activePrefix}help to see all available commands.`,
          threadID,
          messageID,
        );
      }
    }

    const { meta } = command;

    // Command-level bans
    if (!ADMINBOT.includes(senderID)) {
      const tBans = commandBanned.get(threadID) || [];
      const uBans = commandBanned.get(senderID)  || [];
      if (tBans.includes(meta.name)) return _bannedReply(api, `⛔ "${meta.name}" is disabled in this thread.`, threadID, messageID);
      if (uBans.includes(meta.name)) return _bannedReply(api, `⛔ You are banned from "${meta.name}".`,         threadID, messageID);
    }

    // NSFW check
    if (meta.category?.toLowerCase() === 'nsfw' &&
        !global.data.threadAllowNSFW.includes(threadID) &&
        !ADMINBOT.includes(senderID)) {
      return _bannedReply(api, '🔞 NSFW commands are not enabled in this thread.', threadID, messageID);
    }

    return await _executeCommand({
      api, event, models, Users, Threads, Currencies, commands, cooldowns,
      commandName: meta.name, args, senderID, threadID, messageID,
      ADMINBOT, PERMISSION_LEVEL, PERMISSION_LABEL, dateNow, DeveloperMode,
      commandOverride: command,
    });
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Send a ban/error message then auto-unsend after 5s. */
async function _bannedReply(api, text, threadID, messageID) {
  api.sendMessage(text, threadID, async (err, info) => {
    if (!err) {
      await new Promise(r => setTimeout(r, 5000));
      api.unsendMessage(info.messageID);
    }
  }, messageID);
}

/** Resolve permission level for a user (includes PREMIUM) */
async function _resolvePermission(senderID, threadID, ADMINBOT, Threads) {
  senderID = String(senderID);
  if (ADMINBOT.includes(senderID)) return 3;

  // Premium check
  const isPremium = Array.isArray(global.config.PREMIUM) && global.config.PREMIUM.includes(senderID);
  if (isPremium) return 2;

  // Group admin check
  try {
    const info    = global.data.threadInfo.get(threadID) || await Threads.getInfo(threadID);
    const isAdmin = (info?.adminIDs || []).some(a => String(a.id) === senderID);
    return isAdmin ? 1 : 0;
  } catch {
    return 0;
  }
}

/** Execute a resolved command with full permission + cooldown checks. */
async function _executeCommand({
  api, event, models, Users, Threads, Currencies, commands, cooldowns,
  commandName, args, senderID, threadID, messageID,
  ADMINBOT, PERMISSION_LEVEL, PERMISSION_LABEL, dateNow, DeveloperMode,
  commandOverride = null, aiMode = false,
}) {
  // Support aliases in AI-executed commands as well
  let command = commandOverride || commands.get(commandName);
  if (!command) {
    for (const [, cmd] of commands.entries()) {
      if ((cmd.meta?.aliases || []).some(a => String(a).toLowerCase() === commandName)) {
        command = cmd;
        break;
      }
    }
  }

  if (!command) {
    return api.sendMessage(
      `❓ Command "${commandName}" not found.\nType ${global.config.PREFIX || '/'}help to see all available commands.`,
      threadID,
      messageID,
    );
  }

  const { meta } = command;

  // ── Strict permission + visibility check (synced with help.js) ───────
  if (!isCommandVisible(command, senderID, threadID)) {
    const required = PERMISSION_LEVEL[meta.type] ?? 0;
    return api.sendMessage(
      `🔒 "${meta.name}" requires ${PERMISSION_LABEL[required]} permission.`,
      threadID, messageID,
    );
  }

  const userPerm = await _resolvePermission(senderID, threadID, ADMINBOT, Threads);

  if (!cooldowns.has(meta.name)) cooldowns.set(meta.name, new Map());
  const timestamps     = cooldowns.get(meta.name);
  const expirationTime = (meta.cooldowns || 1) * 1000;

  if (timestamps.has(senderID) && dateNow < timestamps.get(senderID) + expirationTime) {
    return api.setMessageReaction('⏱️', messageID, () => {}, true);
  }

  try {
    const response = createResponse(api, event);

    // ── Usage guide factory (plain text, no markdown) ─────────────────────
    function createUsage(command) {
      const prefix = global.config.PREFIX || '';
      return async function usage() {
        const m      = command.meta || {};
        const guides = Array.isArray(m.guide) ? m.guide : [m.guide || ''];
        let text = '▫️ Usage Guide:\n\n';
        for (const g of guides)
          text += g ? `${prefix}${m.name} ${g}\n` : `${prefix}${m.name}\n`;
        text += `\n📄 ${m.description || 'No description provided.'}`;
        await response.reply(text);
      };
    }

    const usage = createUsage(command);

    await command.onStart({ api, event, args, models, Users, Threads, Currencies, response, permission: userPerm, usage });
    timestamps.set(senderID, dateNow);

    if (DeveloperMode) {
      const prefix = aiMode ? '[AI]' : '';
      logger(`${prefix} Executed "${meta.name}" | user:${senderID} | thread:${threadID} | ${Date.now() - dateNow}ms`, 'DEV');
    }
  } catch (e) {
    logger.error(`"${meta.name}" threw: ${e.message}`);
    api.sendMessage(`⚠️ Error in "${meta.name}": ${e.message}`, threadID);
  }
}