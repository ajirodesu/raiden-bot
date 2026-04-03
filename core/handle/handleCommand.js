import logger from '../utils/log.js';
import { createResponse } from '../system/response.js';
import { createRequire } from 'module';
import { Groq } from 'groq-sdk';   // ← Groq AI

const require          = createRequire(import.meta.url);
const stringSimilarity = require('string-similarity');

// Permission levels matched to meta.type
const PERMISSION_LEVEL = {
  anyone:     0,
  groupadmin: 1,
  premium:    2,
  developer:  3,
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Handles incoming messages and dispatches to the matching command's onStart().
 * 
 * UPDATED AI FUNCTIONALITY (powered by Groq + ST-FCA):
 * - AI triggers automatically whenever ${global.config.BOTNAME} is mentioned ANYWHERE in the message.
 * - NO PREFIX REQUIRED for AI.
 * - Example: "Hey wataru send a cosplay" → AI understands and executes the "cosplay" command.
 * - If the requested command doesn't exist → AI replies normally.
 * - AI can answer ANY question.
 * - User recognition: fetches real name + ID via ST-FCA (api.getUserInfo) and includes it in the prompt.
 * 
 * Normal commands still require the prefix (unless bot name is mentioned → AI takes over).
 */
export default function handleCommand({ api, models, Users, Threads, Currencies }) {
  // ── Groq AI client ─────────────────────────────────────────────────────
  const groqClient = new Groq({
    apiKey: global.config.GROQ_API_KEY || process.env.GROQ_API_KEY,
  });

  if (!global.config.GROQ_API_KEY && !process.env.GROQ_API_KEY) {
    console.warn('[WARN] GROQ_API_KEY is not set. AI will not work.');
  }

  return async function ({ event }) {
    const dateNow = Date.now();
    const { allowInbox, PREFIX, ADMINBOT, DeveloperMode, BOTNAME } = global.config;
    const { userBanned, threadBanned, threadData, commandBanned } = global.data;
    const { commands, cooldowns } = global.client;

    let { body, senderID, threadID, messageID } = event;
    senderID = String(senderID);
    threadID = String(threadID);

    if (!body) return;

    // ── AI Trigger: bot name mentioned anywhere (NO prefix needed) ───────
    const botName = BOTNAME || 'bot';
    const isAIMention = body.toLowerCase().includes(botName.toLowerCase());

    // ── Prefix check (only for normal commands) ──────────────────────────
    const threadSetting = threadData.get(threadID) || {};
    const activePrefix  = threadSetting.PREFIX || PREFIX;
    const prefixRegex   = new RegExp(`^(<@!?${senderID}>|${escapeRegex(activePrefix)})\\s*`);

    if (!isAIMention && !prefixRegex.test(body)) return;

    // ── Ban checks (common for both AI and commands) ─────────────────────
    if (!ADMINBOT.includes(senderID)) {
      if (userBanned.has(senderID)) {
        const { reason, dateAdded } = userBanned.get(senderID);
        return api.sendMessage(
          `❌ You are banned from using this bot.\nReason: ${reason}\nDate: ${dateAdded}`,
          threadID, async (err, info) => {
            if (!err) {
              await new Promise(r => setTimeout(r, 5000));
              api.unsendMessage(info.messageID);
            }
          }, messageID,
        );
      }
      if (threadBanned.has(threadID)) {
        const { reason, dateAdded } = threadBanned.get(threadID);
        return api.sendMessage(
          `❌ This thread is banned from using this bot.\nReason: ${reason}\nDate: ${dateAdded}`,
          threadID, async (err, info) => {
            if (!err) {
              await new Promise(r => setTimeout(r, 5000));
              api.unsendMessage(info.messageID);
            }
          }, messageID,
        );
      }
    }

    // ── Parse query based on mode ────────────────────────────────────────
    let fullQuery = body;
    let commandName = '';
    let args = [];

    if (!isAIMention) {
      // Normal command mode (prefix required)
      const [matchedPrefix] = body.match(prefixRegex);
      fullQuery = body.slice(matchedPrefix.length).trim();
      args = fullQuery.split(/\s+/);
      commandName = args.shift()?.toLowerCase() || '';
    }
    // AI mode uses the FULL original message as query

    // ── AI MODE ─────────────────────────────────────────────────────────
    if (isAIMention) {
      // Get user's real name using ST-FCA (api.getUserInfo)
      let userName = `User ${senderID}`;
      try {
        const userInfo = await new Promise((resolve) => {
          api.getUserInfo(senderID, (err, data) => {
            if (err || !data?.[senderID]) return resolve({});
            resolve(data[senderID]);
          });
        });
        if (userInfo.name) userName = userInfo.name;
      } catch (e) {
        // fallback
      }

      const availableCommands = [...commands.keys()].join(', ');

      const systemPrompt = `You are a helpful AI assistant inside a Messenger bot named "${botName}".

Current user: ${userName} (Facebook ID: ${senderID})

Available bot commands: ${availableCommands}

Rules:
- If the user is asking you to run, send, use, or execute any bot command (example: "send a cosplay", "play music hello", "run help", "give me rank", etc.), respond **ONLY** with valid JSON and nothing else:
{
  "action": "execute_command",
  "commandName": "exact_command_name_from_the_list",
  "args": ["arg1", "arg2", ...]
}
- Otherwise, give a friendly, helpful, natural response.`;

      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: fullQuery }
      ];

      let aiText = '';
      try {
        const completion = await groqClient.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.7,
          max_tokens: 1200,
        });
        aiText = completion.choices[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";
      } catch (aiError) {
        console.error('[AI Groq Error]', aiError);
        return api.sendMessage('❌ AI service is temporarily unavailable. Please try again later.', threadID, messageID);
      }

      // Check if AI wants to execute a command
      let executeCommandName = null;
      let executeArgs = [];

      const cleaned = aiText.replace(/```(?:json)?|```/g, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.action === "execute_command" &&
            typeof parsed.commandName === "string" &&
            Array.isArray(parsed.args)) {
          executeCommandName = parsed.commandName.toLowerCase().trim();
          executeArgs = parsed.args.map(a => String(a).trim());
        }
      } catch (e) {
        // Not JSON → normal reply
      }

      if (executeCommandName) {
        const targetCommand = commands.get(executeCommandName);
        if (!targetCommand) {
          return api.sendMessage(`❌ The command "${executeCommandName}" doesn't exist.`, threadID, messageID);
        }

        // Permission check
        let userPermission = 0;
        if (ADMINBOT.includes(senderID)) userPermission = 3;
        else if (event.isGroup) {
          try {
            const info = global.data.threadInfo.get(threadID) || await Threads.getInfo(threadID);
            const isAdmin = (info.adminIDs || []).some(a => a.id === senderID);
            if (isAdmin) userPermission = 1;
          } catch {}
        }

        const targetMeta = targetCommand.meta;
        const required = PERMISSION_LEVEL[targetMeta.type] ?? 0;
        if (required > userPermission) {
          const labels = ['anyone', 'group admin', 'premium user', 'developer'];
          return api.sendMessage(
            `🔒 I can't run "${executeCommandName}" — it requires ${labels[required]} permission.`,
            threadID, messageID
          );
        }

        // Cooldown check
        if (!cooldowns.has(executeCommandName)) cooldowns.set(executeCommandName, new Map());
        const targetTimestamps = cooldowns.get(executeCommandName);
        const expirationTime = (targetMeta.cooldowns || 1) * 1000;

        if (targetTimestamps.has(senderID) && dateNow < targetTimestamps.get(senderID) + expirationTime) {
          return api.setMessageReaction('⏱️', messageID, () => {}, true);
        }

        // Execute the command
        try {
          const response = createResponse(api, event);
          await targetCommand.onStart({
            api,
            event,
            args: executeArgs,
            models,
            Users,
            Threads,
            Currencies,
            response,
            permission: userPermission
          });

          targetTimestamps.set(senderID, dateNow);

          if (DeveloperMode) {
            logger(
              `AI executed "${executeCommandName}" | user:${senderID} | thread:${threadID} | args:[${executeArgs.join(', ')}]`,
              '[ DEV ]'
            );
          }
          return;
        } catch (execError) {
          console.error(`[AI Execute] "${executeCommandName}" error:`, execError);
          return api.sendMessage(`⚠️ Failed to run "${executeCommandName}" (AI request):\n${execError.message}`, threadID, messageID);
        }
      } else {
        // Normal AI reply
        return api.sendMessage(aiText, threadID, messageID);
      }
    }

    // ── NORMAL COMMAND MODE (prefix + no botname mention) ───────────────
    let command = commands.get(commandName);
    if (!command) {
      const allNames = [...commands.keys()];
      if (!allNames.length) return;

      const best = stringSimilarity.findBestMatch(commandName, allNames).bestMatch;
      if (best.rating >= 0.5) {
        command = commands.get(best.target);
      } else {
        return api.sendMessage(
          `❓ Command "${commandName}" not found. Did you mean something else?`,
          threadID,
        );
      }
    }

    const { meta } = command;

    // ── Command-level ban check ──────────────────────────────────────────
    if (!ADMINBOT.includes(senderID)) {
      const threadBans = commandBanned.get(threadID) || [];
      const userBans   = commandBanned.get(senderID)  || [];
      if (threadBans.includes(meta.name)) {
        return api.sendMessage(
          `⛔ The command "${meta.name}" is disabled in this thread.`, threadID, async (err, info) => {
            if (!err) { await new Promise(r => setTimeout(r, 5000)); api.unsendMessage(info.messageID); }
          }, messageID,
        );
      }
      if (userBans.includes(meta.name)) {
        return api.sendMessage(
          `⛔ You are banned from using the command "${meta.name}".`, threadID, async (err, info) => {
            if (!err) { await new Promise(r => setTimeout(r, 5000)); api.unsendMessage(info.messageID); }
          }, messageID,
        );
      }
    }

    // ── NSFW check ───────────────────────────────────────────────────────
    if (meta.category?.toLowerCase() === 'nsfw' &&
        !global.data.threadAllowNSFW.includes(threadID) &&
        !ADMINBOT.includes(senderID)) {
      return api.sendMessage(
        '🔞 NSFW commands are not enabled in this thread.', threadID, async (err, info) => {
          if (!err) { await new Promise(r => setTimeout(r, 5000)); api.unsendMessage(info.messageID); }
        }, messageID,
      );
    }

    // ── Permission check ─────────────────────────────────────────────────
    let userPermission = 0;
    if (ADMINBOT.includes(senderID)) {
      userPermission = 3;
    } else if (event.isGroup) {
      try {
        const info  = global.data.threadInfo.get(threadID) || await Threads.getInfo(threadID);
        const isAdmin = (info.adminIDs || []).some(a => a.id === senderID);
        if (isAdmin) userPermission = 1;
      } catch { /* thread info unavailable */ }
    }

    const required = PERMISSION_LEVEL[meta.type] ?? 0;
    if (required > userPermission) {
      const labels = ['anyone', 'group admin', 'premium user', 'developer'];
      return api.sendMessage(
        `🔒 "${meta.name}" requires ${labels[required]} permission.`, threadID, messageID,
      );
    }

    // ── Cooldown check ───────────────────────────────────────────────────
    if (!cooldowns.has(meta.name)) cooldowns.set(meta.name, new Map());
    const timestamps     = cooldowns.get(meta.name);
    const expirationTime = (meta.cooldowns || 1) * 1000;
    if (timestamps.has(senderID) && dateNow < timestamps.get(senderID) + expirationTime) {
      return api.setMessageReaction('⏱️', messageID, () => {}, true);
    }

    // ── Execute normal command ───────────────────────────────────────────
    try {
      const response = createResponse(api, event);
      await command.onStart({ api, event, args, models, Users, Threads, Currencies, response, permission: userPermission });
      timestamps.set(senderID, dateNow);

      if (DeveloperMode) {
        logger(
          `Executed "${meta.name}" | user:${senderID} | thread:${threadID} | args:[${args.join(', ')}] | ${Date.now() - dateNow}ms`,
          '[ DEV ]',
        );
      }
    } catch (e) {
      console.error(`[handleCommand] "${meta.name}" threw:`, e);
      api.sendMessage(`⚠️ An error occurred while running "${meta.name}":\n${e.message}`, threadID);
    }
  };
}