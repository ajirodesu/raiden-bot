import logger              from '../utils/log.js';
import { createResponse }  from '../system/response.js';
import { createRequire }   from 'module';
import { Groq }            from 'groq-sdk';

const require          = createRequire(import.meta.url);
const stringSimilarity = require('string-similarity');

const PERMISSION_LEVEL = { anyone: 0, groupadmin: 1, premium: 2, developer: 3 };
const PERMISSION_LABEL = ['anyone', 'group admin', 'premium user', 'developer'];

// ── Shared helpers ────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve a command by exact name or alias from the commands Map.
 * Returns the command object or null.
 */
function resolveCommand(name, commands) {
  const cmd = commands.get(name);
  if (cmd) return cmd;
  for (const [, c] of commands) {
    if ((c.meta?.aliases || []).some(a => String(a).toLowerCase() === name)) return c;
  }
  return null;
}

/** Check whether a command is accessible to the given user in the given thread. */
function isCommandVisible(command, senderID, threadID) {
  const m       = command.meta || {};
  const reqType = (m.type || 'anyone').toLowerCase();

  if (String(m.category || '').toLowerCase() === 'hidden') return false;

  const userID    = String(senderID);
  const tid       = String(threadID);
  const config    = global.config || {};
  const isDev     = Array.isArray(config.ADMINBOT) && config.ADMINBOT.includes(userID);
  const isPremium = Array.isArray(config.PREMIUM)  && config.PREMIUM.includes(userID);

  // Thread-level privilege elevation
  const isThreadDev     = global.data.threadAdminBot?.has(tid) ?? false;
  const isThreadPremium = global.data.threadPremium?.has(tid)  ?? false;

  let isGroupAdmin = false;
  try {
    const info = global.data.threadInfo?.get(tid) || global.data.threadInfo?.get(parseInt(tid));
    if (info?.adminIDs) isGroupAdmin = info.adminIDs.some(a => String(a.id) === userID);
  } catch { /* non-fatal */ }

  const effectiveDev     = isDev     || isThreadDev;
  const effectivePremium = isPremium || isThreadPremium || effectiveDev;

  if (reqType === 'anyone')     return true;
  if (reqType === 'groupadmin') return isGroupAdmin || effectiveDev;
  if (reqType === 'premium')    return effectivePremium;
  if (reqType === 'developer')  return effectiveDev;
  return false;
}

/** Resolve numeric permission level for a user (premium now works exactly like ADMINBOT but at a lower level). */
async function resolvePermission(senderID, threadID, ADMINBOT, PREMIUM, Threads) {
  senderID = String(senderID);
  threadID = String(threadID);

  // Individual developer (highest level)
  if (Array.isArray(ADMINBOT) && ADMINBOT.includes(senderID)) return 3;

  // Thread elevated to developer level → everyone in it gets level 3
  if (global.data.threadAdminBot?.has(threadID)) return 3;

  // Individual premium (works exactly like ADMINBOT structure but lower level)
  if (Array.isArray(PREMIUM) && PREMIUM.includes(senderID)) return 2;

  // Thread elevated to premium → everyone in it gets level 2
  if (global.data.threadPremium?.has(threadID)) return 2;

  try {
    const info    = global.data.threadInfo.get(threadID) || await Threads.getInfo(threadID);
    const isAdmin = (info?.adminIDs || []).some(a => String(a.id) === senderID);
    return isAdmin ? 1 : 0;
  } catch {
    return 0;
  }
}

/** Send a temporary ban/restriction notice that auto-unsends after 5 s. */
async function bannedReply(api, text, threadID, messageID) {
  api.sendMessage(text, threadID, async (err, info) => {
    if (!err) {
      await new Promise(r => setTimeout(r, 5000));
      api.unsendMessage(info.messageID);
    }
  }, messageID);
}

/** Helper — safely set a message reaction (fire-and-forget). */
function safeReact(api, messageID, emoji) {
  try {
    api.setMessageReaction(emoji, messageID, () => {}, true);
  } catch { /* ignore */ }
}

// ── handleCommand factory ─────────────────────────────────────────────────

export default function handleCommand({ api, models, Users, Threads, Currencies }) {
  const groqApiKey = global.config.GROQ_API_KEY || process.env.GROQ_API_KEY;
  const groqClient = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

  return async function ({ event }) {
    const dateNow = Date.now();
    const { allowInbox, PREFIX, ADMINBOT, PREMIUM, DeveloperMode, BOTNAME } = global.config;
    const { userBanned, threadBanned, threadData, commandBanned }   = global.data;
    const { commands, cooldowns }                                    = global.client;

    let { body, senderID, threadID, messageID } = event;
    senderID = String(senderID);
    threadID = String(threadID);

    if (!body) return;
    if (!allowInbox && senderID === threadID) return;

    const botName     = BOTNAME || 'Raiden';
    const isAIMention = body.toLowerCase().includes(botName.toLowerCase());

    const threadSetting = threadData.get(threadID) || {};
    const activePrefix  = threadSetting.PREFIX || PREFIX;
    const prefixRegex   = new RegExp(`^(<@!?${senderID}>|${escapeRegex(activePrefix)})\\s*`);
    const hasPrefixCmd  = prefixRegex.test(body);

    if (!isAIMention && !hasPrefixCmd) return;

    // ── Quick-parse command name (needed for ignore-list checks below) ──
    // We do a lightweight parse here so DeveloperOnly and OnlyAdminBox
    // exempt lists can be evaluated before the full command resolution.
    let quickCmdName = null;
    if (hasPrefixCmd) {
      const [qMatch]  = body.match(prefixRegex);
      const qRaw      = body.slice(qMatch.length).trim().split(/\s+/)[0]?.toLowerCase();
      if (qRaw) {
        const qResolved = resolveCommand(qRaw, commands);
        quickCmdName    = qResolved?.meta?.name || qRaw;
      }
    }

    // ── Ban checks ──────────────────────────────────────────────────────
    if (!ADMINBOT.includes(senderID)) {
      if (userBanned.has(senderID)) {
        const { reason, dateAdded } = userBanned.get(senderID);
        return bannedReply(api, `🔴 You are banned.\nReason: ${reason}\nDate: ${dateAdded}`, threadID, messageID);
      }
      if (threadBanned.has(threadID)) {
        const { reason, dateAdded } = threadBanned.get(threadID);
        return bannedReply(api, `🔴 This group is banned.\nReason: ${reason}\nDate: ${dateAdded}`, threadID, messageID);
      }
    }

    // ── Developer Only mode ──────────────────────────────────────────────
    // When DeveloperOnly is true in config.json, only ADMINBOT members can
    // trigger any command or AI. All others get a silent ⚠️ reaction.
    // Commands listed in config.DeveloperOnlyIgnore are exempt and remain
    // usable by everyone (managed via the `ignoreonlydev` command).
    if (global.config.DeveloperOnly && !ADMINBOT.includes(senderID)) {
      const devIgnoreList = global.config.DeveloperOnlyIgnore || [];
      if (!quickCmdName || !devIgnoreList.includes(quickCmdName)) {
        safeReact(api, messageID, '⚠️');
        return;
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // AI MODE
    // ════════════════════════════════════════════════════════════════════
    if (isAIMention) {
      if (!groqClient) {
        return api.sendMessage('🔴 AI is not configured (missing GROQ_API_KEY).', threadID, messageID);
      }

      safeReact(api, messageID, '⏳');

      let userName = `User ${senderID}`;
      try {
        const userInfo = await new Promise(res => {
          api.getUserInfo(senderID, (err, data) => res(err || !data?.[senderID] ? {} : data[senderID]));
        });
        if (userInfo?.name) userName = userInfo.name;
      } catch { /* fallback */ }

      const dev = global.config.DEVELOPER || {};
      const developerInfo    = `${dev.NAME || 'Unknown'} (ID: ${dev.ID || 'N/A'}, Link: ${dev.LINK || 'N/A'})`;
      const availableCommands = [...commands.keys()].join(', ');

      // ── Current time awareness using global.config.TIMEZONE ─────────────
      const timezone = global.config.TIMEZONE || 'UTC';
      let currentTimeStr = 'Unknown';
      try {
        const now = new Date();
        currentTimeStr = now.toLocaleString('en-US', {
          timeZone: timezone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZoneName: 'short'
        });
      } catch {
        currentTimeStr = new Date().toISOString();
      }

      const systemPrompt =
        `You are a helpful AI assistant inside a Messenger bot named "${botName}".\n` +
        `Developer/owner: ${developerInfo}\n` +
        `Current user: ${userName} (ID: ${senderID})\n` +
        `Current time (${timezone}): ${currentTimeStr}\n` +
        `Available commands: ${availableCommands}\n\n` +
        `Rules:\n` +
        `- If user ID matches developer ID (${dev.ID || 'N/A'}), be extra friendly and helpful.\n` +
        `- When asked about your developer/owner, always use the exact info above.\n` +
        `- To run a bot command, respond ONLY with valid JSON:\n` +
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
        safeReact(api, messageID, '🔴');
        return api.sendMessage('🔴 AI service temporarily unavailable.', threadID, messageID);
      }

      // Check if AI wants to execute a command
      const cleaned = aiText.replace(/```(?:json)?|```/g, '').trim();
      let execCmd = null, execArgs = [];
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.action === 'execute_command' && typeof parsed.commandName === 'string' && Array.isArray(parsed.args)) {
          execCmd  = parsed.commandName.toLowerCase().trim();
          execArgs = parsed.args.map(a => String(a).trim());
        }
      } catch { /* not JSON */ }

      if (execCmd) {
        return executeCommand({
          api, event, models, Users, Threads, Currencies, commands, cooldowns,
          commandName: execCmd, args: execArgs, senderID, threadID, messageID,
          ADMINBOT, PREMIUM, dateNow, DeveloperMode, aiMode: true,
        });
      }

      safeReact(api, messageID, '🟢');
      return api.sendMessage(aiText, threadID, messageID);
    }

    // ════════════════════════════════════════════════════════════════════
    // PREFIX COMMAND MODE
    // ════════════════════════════════════════════════════════════════════
    const [matchedPrefix] = body.match(prefixRegex);
    const argsFull        = body.slice(matchedPrefix.length).trim().split(/\s+/);
    const commandName     = argsFull.shift()?.toLowerCase() || '';
    const args            = argsFull;

    if (!commandName) {
      return api.sendMessage(
        `🟢 System Online.\nType ${activePrefix}help to see commands.`,
        threadID, messageID,
      );
    }

    let command = resolveCommand(commandName, commands);

    if (!command) {
      const allNames = [...commands.keys()];
      if (!allNames.length) return;
      const best = stringSimilarity.findBestMatch(commandName, allNames).bestMatch;
      if (best.rating >= 0.5) {
        command = commands.get(best.target);
      } else {
        return api.sendMessage(
          `🔴 Command "${commandName}" not found.\n` +
          (best.rating >= 0.3 ? `Did you mean: ${activePrefix}${best.target}?\n\n` : '') +
          `Type ${activePrefix}help to see all available commands.`,
          threadID, messageID,
        );
      }
    }

    const { meta } = command;

    // Command-level bans
    if (!ADMINBOT.includes(senderID)) {
      const tBans = commandBanned.get(threadID) || [];
      const uBans = commandBanned.get(senderID)  || [];
      if (tBans.includes(meta.name)) return bannedReply(api, `⛔ "${meta.name}" is disabled in this thread.`, threadID, messageID);
      if (uBans.includes(meta.name)) return bannedReply(api, `⛔ You are banned from "${meta.name}".`,         threadID, messageID);
    }

    // ── Only Admin Box mode ──────────────────────────────────────────────
    // Per-thread setting: when onlyAdminBox is true, only group admins can
    // use the bot in this thread. Non-admins get a ⚠️ reaction (unless
    // onlyAdminBoxNoti is false, in which case the message is silently ignored).
    // Commands listed in tSetting.ignoreCommandAdminBox are exempt and remain
    // usable by all members (managed via the `ignoreonlydevbox` command).
    if (event.isGroup && !ADMINBOT.includes(senderID)) {
      const tSetting   = threadData.get(threadID) || {};
      if (tSetting.onlyAdminBox) {
        const tInfo      = global.data.threadInfo.get(threadID) || {};
        const isGrpAdmin = (tInfo.adminIDs || []).some(a => String(a.id) === senderID);
        if (!isGrpAdmin) {
          const boxIgnoreList = tSetting.ignoreCommandAdminBox || [];
          if (!boxIgnoreList.includes(meta.name)) {
            // Show ⚠️ reaction by default; suppress it if noti is explicitly false
            if (tSetting.onlyAdminBoxNoti !== false) {
              safeReact(api, messageID, '⚠️');
            }
            return;
          }
        }
      }
    }

    // NSFW check
    if (meta.category?.toLowerCase() === 'nsfw' &&
        !global.data.threadAllowNSFW.includes(threadID) &&
        !ADMINBOT.includes(senderID)) {
      return bannedReply(api, '🔞 NSFW commands are not enabled in this thread.', threadID, messageID);
    }

    return executeCommand({
      api, event, models, Users, Threads, Currencies, commands, cooldowns,
      commandName: meta.name, args, senderID, threadID, messageID,
      ADMINBOT, PREMIUM, dateNow, DeveloperMode,
      commandOverride: command,
    });
  };
}

// ── Command executor ──────────────────────────────────────────────────────

async function executeCommand({
  api, event, models, Users, Threads, Currencies, commands, cooldowns,
  commandName, args, senderID, threadID, messageID,
  ADMINBOT, PREMIUM, dateNow, DeveloperMode,
  commandOverride = null, aiMode = false,
}) {
  const command = commandOverride || resolveCommand(commandName, commands);

  if (!command) {
    safeReact(api, messageID, '🔴');
    return api.sendMessage(
      `🔴 Command "${commandName}" not found.\nType ${global.config.PREFIX || '/'}help to see all available commands.`,
      threadID, messageID,
    );
  }

  const { meta } = command;

  // Permission + visibility check
  if (!isCommandVisible(command, senderID, threadID)) {
    const required = PERMISSION_LEVEL[meta.type] ?? 0;
    safeReact(api, messageID, '🔴');
    return api.sendMessage(
      `🔴 "${meta.name}" requires ${PERMISSION_LABEL[required]} permission.`,
      threadID, messageID,
    );
  }

  const userPerm = await resolvePermission(senderID, threadID, ADMINBOT, PREMIUM, Threads);

  if (!cooldowns.has(meta.name)) cooldowns.set(meta.name, new Map());
  const timestamps     = cooldowns.get(meta.name);
  const expirationTime = (meta.cooldowns || 1) * 1000;

  if (timestamps.has(senderID) && dateNow < timestamps.get(senderID) + expirationTime) {
    return safeReact(api, messageID, '⏱️');
  }

  // ── React ⏳ to signal processing ─────────────────────────────────────
  safeReact(api, messageID, '⏳');

  try {
    const response = createResponse(api, event);

    const usage = buildUsage(command, response);

    await command.onStart({
      api, event, args, models, Users, Threads, Currencies,
      response, permission: userPerm, usage,
    });

    timestamps.set(senderID, dateNow);

    // ── React 🟢 on success ───────────────────────────────────────────
    safeReact(api, messageID, '🟢');

    if (DeveloperMode) {
      logger(`${aiMode ? '[AI] ' : ''}Executed "${meta.name}" | user:${senderID} | thread:${threadID} | ${Date.now() - dateNow}ms`, 'DEV');
    }
  } catch (e) {
    logger.error(`"${meta.name}" threw: ${e.message}`);
    // ── React 🔴 on error ─────────────────────────────────────────────
    safeReact(api, messageID, '🔴');
    api.sendMessage(`⚠️ Error in "${meta.name}": ${e.message}`, threadID);
  }
}

/** Build a usage() helper for a command. */
function buildUsage(command, response) {
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