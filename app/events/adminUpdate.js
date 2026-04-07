/**
 * adminUpdate.js — Group admin/settings change notifications
 * Converted to Raiden ESM format by Claude
 *
 * Watches for group log events (admin changes, nickname, name, icon, calls,
 * polls, theme) and sends a formatted notification to the thread.
 * Respects the per-thread `sendGcNoti` setting — set it to false to silence.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────
const AUTO_UNSEND    = true;   // unsend the notification after the delay below
const TIME_TO_UNSEND = 10;     // seconds before unsending

// ── Icon store (persisted to data/emoji.json) ─────────────────────────────
const DATA_DIR  = join(__dirname, 'data');
const ICON_PATH = join(DATA_DIR, 'emoji.json');

function readIconStore() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(ICON_PATH)) writeFileSync(ICON_PATH, '{}');
    return JSON.parse(readFileSync(ICON_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeIconStore(store) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(ICON_PATH, JSON.stringify(store, null, 2));
  } catch { /* non-fatal */ }
}

// ── Meta ──────────────────────────────────────────────────────────────────
export const meta = {
  name:        'adminUpdate',
  version:     '2.5.0',
  author:      'ST | Sheikh Tamim | Converted by Claude',
  description: 'Sends notifications when group settings or admins change.',
  category:    'events',
  eventType:   [
    'log:thread-admins',
    'log:user-nickname',
    'log:thread-name',
    'log:thread-icon',
    'log:thread-call',
    'log:magic-words',
    'log:thread-poll',
    'log:thread-approval-mode',
    'log:thread-color',
  ],
};

// ── Helper — send and optionally auto-unsend ───────────────────────────────
async function sendNotification(api, message, threadID) {
  try {
    const sentInfo = await new Promise((resolve, reject) => {
      api.sendMessage(message, threadID, (err, info) => {
        if (err) return reject(err);
        resolve(info);
      });
    });

    if (AUTO_UNSEND && sentInfo?.messageID) {
      setTimeout(() => {
        // stfca's unsendMessage is callback-based and returns undefined — no .catch()
        try { api.unsendMessage(sentInfo.messageID, () => {}); } catch { /* non-fatal */ }
      }, TIME_TO_UNSEND * 1000);
    }
  } catch { /* non-fatal — thread may have restricted the bot */ }
}

// ── onEvent ───────────────────────────────────────────────────────────────
export async function onEvent({ api, event, Threads, Users }) {
  const { logMessageType, logMessageData, threadID, author } = event;

  // Ignore bot-sent events and DMs
  if (!threadID || author === threadID) return;

  // Check per-thread notification setting
  let threadData = {};
  try {
    const row  = await Threads.getData(threadID);
    threadData = row?.data || {};
    // If sendGcNoti is explicitly false, stay silent
    if (threadData.sendGcNoti === false) return;
  } catch {
    return;
  }

  let message = '';

  switch (logMessageType) {

    // ── Admin added / removed ────────────────────────────────────────────
    case 'log:thread-admins': {
      if (logMessageData.ADMIN_EVENT === 'add_admin') {
        message =
          `[ GROUP UPDATE ]\n` +
          `» New Admin\n\n` +
          `${logMessageData.TARGET_ID} is now an admin`;
      } else if (logMessageData.ADMIN_EVENT === 'remove_admin') {
        message =
          `[ GROUP UPDATE ]\n` +
          `» ${logMessageData.TARGET_ID} has been removed as admin`;
      }
      break;
    }

    // ── Nickname changed ─────────────────────────────────────────────────
    case 'log:user-nickname': {
      const nicknameText =
        logMessageData.nickname?.length === 0
          ? `Removed nickname for user ${logMessageData.participant_id}`
          : `Updated nickname for ${logMessageData.participant_id} to: ${logMessageData.nickname}`;
      message = `[ GROUP UPDATE ]\n» ${nicknameText}`;
      break;
    }

    // ── Thread name changed ──────────────────────────────────────────────
    case 'log:thread-name': {
      const nameText = logMessageData.name
        ? `Updated group name to: ${logMessageData.name}`
        : 'Removed group name';
      message = `[ GROUP UPDATE ]\n» ${nameText}`;
      break;
    }

    // ── Thread icon changed ──────────────────────────────────────────────
    case 'log:thread-icon': {
      const store        = readIconStore();
      const previousIcon = store[threadID] || 'unclear';

      message =
        `[ GROUP UPDATE ]\n` +
        `» ${event.logMessageBody.replace('emoticon', 'icon')}\n` +
        `» Original Icon: ${previousIcon}`;

      store[threadID] = logMessageData.thread_icon || '👍';
      writeIconStore(store);
      break;
    }

    // ── Group call events ────────────────────────────────────────────────
    case 'log:thread-call': {
      if (logMessageData.event === 'group_call_started') {
        let callerName = logMessageData.caller_id;
        try {
          callerName = await Users.getNameUser(logMessageData.caller_id);
        } catch { /* fallback to ID */ }
        const callType = logMessageData.video ? 'VIDEO ' : '';
        message = `[ GROUP UPDATE ]\n» ${callerName} started a ${callType}call`;

      } else if (logMessageData.event === 'group_call_ended') {
        const dur     = logMessageData.call_duration || 0;
        const hours   = String(Math.floor(dur / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((dur % 3600) / 60)).padStart(2, '0');
        const seconds = String(dur % 60).padStart(2, '0');
        message =
          `[ GROUP UPDATE ]\n` +
          `» CALL HAS ENDED.\n` +
          `» CALL DURATION: ${hours}:${minutes}:${seconds}`;

      } else if (logMessageData.joining_user) {
        let joinerName = logMessageData.joining_user;
        try {
          joinerName = await Users.getNameUser(logMessageData.joining_user);
        } catch { /* fallback */ }
        const callType = logMessageData.group_call_type === '1' ? 'VIDEO ' : '';
        message = `[ GROUP UPDATE ]\n» ${joinerName} JOINED THE ${callType}CALL.`;
      }
      break;
    }

    // ── Magic words / theme ──────────────────────────────────────────────
    case 'log:magic-words': {
      message =
        `[⚜️] Theme ${logMessageData.magic_word} added effects: ${logMessageData.theme_name}\n` +
        `[⚜️] Emoji: ${logMessageData.emoji_effect || 'No emoji'}\n` +
        `[⚜️] Total ${logMessageData.new_magic_word_count} word effects added`;
      break;
    }

    // ── Poll created ─────────────────────────────────────────────────────
    case 'log:thread-poll': {
      message = event.logMessageBody;
      break;
    }

    // ── Approval mode toggled ────────────────────────────────────────────
    case 'log:thread-approval-mode': {
      message = event.logMessageBody;
      break;
    }

    // ── Theme / color changed ────────────────────────────────────────────
    case 'log:thread-color': {
      message = `[ GROUP UPDATE ]\n» ${event.logMessageBody.replace('Topic', 'color')}`;
      break;
    }

    default:
      return;
  }

  if (message) {
    await sendNotification(api, message, threadID);
  }
}