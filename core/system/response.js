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
 * Normalize a message payload for stfca send/edit methods.
 * @param {string|object} message
 * @returns {string|object}
 */
function normalizeMessage(message) {
  if (typeof message === 'string') return message;
  if (message && typeof message === 'object') return { ...message };
  return String(message ?? '');
}

/**
 * Wrap callback-style api methods in a promise.
 * @param {Function} executor
 * @returns {Promise<any>}
 */
function asPromise(executor) {
  return new Promise((resolve, reject) => {
    try {
      executor((err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * @param {object} api   - FCA api object
 * @param {object} event - Incoming message event
 * @returns {object}     - Response helpers
 */
export function createResponse(api, event) {
  const threadID   = String(event?.threadID ?? '');
  const messageID  = event?.messageID ? String(event.messageID) : undefined;
  const senderID   = event?.senderID ? String(event.senderID) : undefined;
  const mentions   = event?.mentions || {};
  const replyEvent = event?.messageReply || null;

  const call = (methodName, ...args) => {
    const method = api?.[methodName];
    if (typeof method !== 'function') {
      throw new Error(`[response.${methodName}] api.${methodName} is not available.`);
    }

    return asPromise((done) => method.apply(api, [...args, done]));
  };

  const send = (message, targetThreadID = threadID, replyToMessageID = null) => {
    const payload = normalizeMessage(message);
    return asPromise((done) => {
      if (replyToMessageID) {
        return api.sendMessage(payload, targetThreadID, done, replyToMessageID);
      }
      return api.sendMessage(payload, targetThreadID, done);
    });
  };

  const reply = (message, replyToMessageID = messageID) => send(message, threadID, replyToMessageID);
  const react = (emoji, targetMessageID = messageID, isSender = true) => asPromise((done) => {
    if (typeof api.setMessageReaction !== 'function') {
      throw new Error('[response.setMessageReaction] api.setMessageReaction is not available.');
    }
    return api.setMessageReaction(emoji, targetMessageID, done, isSender);
  });
  const unsend = (targetMessageID = messageID) => call('unsendMessage', targetMessageID);
  const edit = (message, targetMessageID = messageID) => call('editMessage', normalizeMessage(message), targetMessageID);
  const typing = (targetThreadID = threadID) => call('sendTypingIndicator', targetThreadID);
  const read = (targetMessageID = messageID) => call('markAsRead', targetMessageID);
  const deliver = (targetThreadID = threadID, targetMessageID = messageID) => call('markAsDelivered', targetThreadID, targetMessageID);
  const seen = (targetThreadID = threadID) => call('markAsSeen', targetThreadID);
  const getMessage = (targetMessageID = messageID) => call('getMessage', targetMessageID);
  const getThreadInfo = (targetThreadID = threadID) => call('getThreadInfo', targetThreadID);
  const getUserInfo = (targetUserID = senderID) => call('getUserInfo', targetUserID);
  const shareContact = (...args) => call('shareContact', ...args);
  const shareLink = (...args) => call('shareLink', ...args);
  const createPoll = (...args) => call('createPoll', ...args);
  const forwardAttachment = (...args) => call('forwardAttachment', ...args);
  const uploadAttachment = (...args) => call('uploadAttachment', ...args);
  const markAsReadAll = (...args) => call('markAsReadAll', ...args);
  const getThreadHistory = (...args) => call('getThreadHistory', ...args);

  return {
    api,
    event,
    threadID,
    messageID,
    senderID,
    mentions,
    messageReply: replyEvent,

    call,
    send,
    reply,
    react,
    unsend,
    edit,
    typing,
    read,
    deliver,
    seen,
    getMessage,
    getThreadInfo,
    getUserInfo,
    shareContact,
    shareLink,
    createPoll,
    forwardAttachment,
    uploadAttachment,
    markAsReadAll,
    getThreadHistory,

    // Backward-compatible aliases and a nested namespace for message helpers.
    sendMessage: send,
    replyMessage: reply,
    reaction: react,
    delete: unsend,
    startTyping: typing,
    markRead: read,
    markDelivered: deliver,
    markSeen: seen,
    message: {
      send,
      reply,
      react,
      unsend,
      edit,
      typing,
      read,
      deliver,
      seen,
      getMessage,
      getThreadInfo,
      getUserInfo,
      shareContact,
      shareLink,
      createPoll,
      forwardAttachment,
      uploadAttachment,
      markAsReadAll,
      getThreadHistory,
      call,
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
