/**
 * echoReaction.js
 * ---------------
 * Mirrors any user reaction back onto the same message (echo / auto-react).
 * Only fires when global.config.autoReaction is true (default).
 * Uses a bounded Set to deduplicate — prevents double-echoing the same messageID
 * and caps memory usage at MAX_CACHE entries.
 *
 * Listens to: message_reaction events (routed through handleEvent)
 * Place in:   app/events/echoReaction.js
 */

const MAX_CACHE = 300;
const reacted   = new Set();   // dedup store — cleared when size > MAX_CACHE

export const meta = {
  name:        'echoReaction',
  version:     '1.0.0',
  author:      'AjiroDesu',
  description: 'Echoes back the user\'s emoji reaction onto the same message automatically.',
  eventType:   ['message_reaction'],   // matched against event.type in handleEvent
};

export async function onEvent({ api, event }) {
  // Feature gate — toggled via json/config.json: "autoReaction": true/false
  if (global.config.autoReaction === false) return;

  const { senderID, messageID, reaction, action } = event;

  // Only mirror fresh "react" actions; ignore "unreact"
  if (action !== 'react' || !reaction) return;

  // Never echo the bot's own reactions
  const botID = String(api.getCurrentUserID());
  if (String(senderID) === botID) return;

  // Deduplicate — skip if we already echoed this message
  if (reacted.has(messageID)) return;

  // Prune cache when it grows too large
  if (reacted.size >= MAX_CACHE) reacted.clear();
  reacted.add(messageID);

  try {
    await new Promise((resolve) =>
      api.setMessageReaction(reaction, messageID, () => resolve(), true)
    );
  } catch {
    // Silently ignore — reaction may have expired or API is unavailable
  }
}