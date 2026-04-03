/**
 * response.js
 * -----------
 * Creates a fluent message-response wrapper for command / event handlers.
 *
 * Usage inside a command:
 *   response.reply('Hello!');
 *   response.send('Broadcast', threadID);
 *   response.react('👍');
 *   const info = await response.send('Pick one:');
 *   response.addReply({ messageID: info.messageID, name: meta.name, author: event.senderID });
 */

/**
 * @param {object} api   - FCA api object
 * @param {object} event - Incoming message event
 * @returns {object}     - Response helpers
 */
export function createResponse(api, event) {
  const { threadID, messageID } = event;

  return {
    /**
     * Reply to the original message (quoted reply).
     * @param {string|object} message
     * @returns {Promise<object>} message info
     */
    reply(message) {
      return new Promise((resolve, reject) => {
        api.sendMessage(message, threadID, (err, info) => {
          if (err) return reject(err);
          resolve(info);
        }, messageID);
      });
    },

    /**
     * Send a message to any thread (defaults to current thread).
     * @param {string|object} message
     * @param {string} [targetThreadID]
     * @returns {Promise<object>} message info
     */
    send(message, targetThreadID = threadID) {
      return new Promise((resolve, reject) => {
        api.sendMessage(message, targetThreadID, (err, info) => {
          if (err) return reject(err);
          resolve(info);
        });
      });
    },

    /**
     * React to the current message.
     * @param {string} emoji
     */
    react(emoji) {
      return new Promise((resolve, reject) => {
        api.setMessageReaction(emoji, messageID, (err) => {
          if (err) return reject(err);
          resolve();
        }, true);
      });
    },

    /**
     * Unsend a message by its ID.
     * @param {string} msgID
     */
    unsend(msgID) {
      return new Promise((resolve, reject) => {
        api.unsendMessage(msgID, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    },

    /**
     * Register an onReply handler for a sent message.
     * @param {object} data - Must include { messageID, name } plus any extra state.
     */
    addReply(data) {
      if (!data?.messageID || !data?.name) {
        throw new Error('[response.addReply] data must include messageID and name.');
      }
      global.client.onReply.push({ ...data, author: data.author || event.senderID });
    },

    /**
     * Register an onReaction handler for a sent message.
     * @param {object} data - Must include { messageID, name } plus any extra state.
     */
    addReaction(data) {
      if (!data?.messageID || !data?.name) {
        throw new Error('[response.addReaction] data must include messageID and name.');
      }
      global.client.onReaction.push({ ...data, author: data.author || event.senderID });
    },
  };
}