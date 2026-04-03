import logger from '../utils/log.js';
import handleCommand        from '../handle/handleCommand.js';
import handleCommandEvent   from '../handle/handleCommandEvent.js';
import handleReply          from '../handle/handleReply.js';
import handleReaction       from '../handle/handleReaction.js';
import handleEvent          from '../handle/handleEvent.js';
import handleCreateDatabase from '../handle/handleCreateDatabase.js';
import UsersController      from '../controllers/users.js';
import ThreadsController    from '../controllers/threads.js';
import CurrenciesController from '../controllers/currencies.js';

/**
 * Bootstraps all handlers, pre-loads database environment, and returns
 * the main listener function that routes incoming FCA events.
 *
 * @param {{ api, models }} param
 * @returns {function} listener - call listener(event) for every inbound event
 */
export default async function createListener({ api, models }) {
  const Users      = UsersController({ models, api });
  const Threads    = ThreadsController({ models, api });
  const Currencies = CurrenciesController({ models });

  // ── Pre-load database environment into global.data ─────────────────────
  logger('Loading environment from database…', '[ DATABASE ]');
  try {
    const [threads, users, currencies] = await Promise.all([
      Threads.getAll(),
      Users.getAll(['userID', 'name', 'data']),
      Currencies.getAll(['userID']),
    ]);

    for (const t of threads) {
      const id = String(t.threadID);
      global.data.allThreadID.push(id);
      global.data.threadData.set(id, t.data || {});
      global.data.threadInfo.set(id, t.threadInfo || {});
      if (t.data?.banned)         global.data.threadBanned.set(id,  { reason: t.data.reason || '', dateAdded: t.data.dateAdded || '' });
      if (t.data?.commandBanned?.length) global.data.commandBanned.set(id, t.data.commandBanned);
      if (t.data?.NSFW)           global.data.threadAllowNSFW.push(id);
    }

    for (const u of users) {
      const id = String(u.userID);
      global.data.allUserID.push(id);
      if (u.name)            global.data.userName.set(id, u.name);
      if (u.data?.banned)    global.data.userBanned.set(id, { reason: u.data.reason || '', dateAdded: u.data.dateAdded || '' });
      if (u.data?.commandBanned?.length) global.data.commandBanned.set(id, u.data.commandBanned);
    }

    for (const c of currencies) global.data.allCurrenciesID.push(String(c.userID));

    logger(`Loaded ${threads.length} threads, ${users.length} users, ${currencies.length} currency records.`, '[ DATABASE ]');
  } catch (error) {
    logger(`Failed to load environment: ${error.message}`, 'error');
  }

  // ── Build handlers ────────────────────────────────────────────────────
  const shared = { api, models, Users, Threads, Currencies };

  const _handleCommand        = handleCommand(shared);
  const _handleCommandEvent   = handleCommandEvent(shared);
  const _handleReply          = handleReply(shared);
  const _handleReaction       = handleReaction(shared);
  const _handleEvent          = handleEvent(shared);
  const _handleCreateDatabase = handleCreateDatabase({ ...shared, api });

  logger(`Handlers ready — ${Date.now() - global.client.timeStart}ms elapsed.`, '[ SYSTEM ]');

  // ── Silence presence / typing noise ──────────────────────────────────
  const SILENT_TYPES = new Set(['presence', 'typ', 'read_receipt']);

  // ── Main router ───────────────────────────────────────────────────────
  return function listener(event) {
    if (SILENT_TYPES.has(event.type)) return;
    if (global.config.DeveloperMode) console.log('[EVENT]', event);

    switch (event.type) {
      case 'message':
      case 'message_reply':
      case 'message_unsend':
        _handleCreateDatabase({ event });
        _handleCommand({ event });
        _handleReply({ event });
        _handleCommandEvent({ event });
        break;

      case 'event':
        _handleEvent({ event });
        break;

      case 'message_reaction':
        _handleReaction({ event });
        break;

      default:
        break;
    }
  };
}