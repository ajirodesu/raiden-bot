/**
 * Threads controller — wraps Sequelize operations for the Threads table.
 * Aliases: get → getData, set → setData (backward-compat with commands).
 */
export default function ThreadsController({ models, api }) {
  const Threads = models.use('Threads');

  async function getInfo(threadID) {
    try {
      return await api.getThreadInfo(threadID);
    } catch (error) {
      console.error('[Threads.getInfo]', error);
      throw error;
    }
  }

  async function getAll(...data) {
    let where, attributes;
    for (const i of data) {
      if (typeof i !== 'object') throw new Error('getAll: argument must be an object or array.');
      if (Array.isArray(i)) attributes = i;
      else where = i;
    }
    try {
      return (await Threads.findAll({ where, attributes })).map(e => e.get({ plain: true }));
    } catch (error) {
      console.error('[Threads.getAll]', error);
      throw error;
    }
  }

  async function getData(threadID) {
    try {
      const row = await Threads.findOne({ where: { threadID } });
      return row ? row.get({ plain: true }) : false;
    } catch (error) {
      console.error('[Threads.getData]', error);
      throw error;
    }
  }

  async function setData(threadID, options = {}) {
    if (typeof options !== 'object' || Array.isArray(options))
      throw new Error('setData: options must be a plain object.');
    try {
      const row = await Threads.findOne({ where: { threadID } });
      if (row) await row.update(options);
      else await createData(threadID, options);
      return true;
    } catch (error) {
      console.error('[Threads.setData]', error);
      throw error;
    }
  }

  async function delData(threadID) {
    try {
      const row = await Threads.findOne({ where: { threadID } });
      if (row) await row.destroy();
      return true;
    } catch (error) {
      console.error('[Threads.delData]', error);
      throw error;
    }
  }

  async function createData(threadID, defaults = {}) {
    if (typeof defaults !== 'object' || Array.isArray(defaults))
      throw new Error('createData: defaults must be a plain object.');
    try {
      await Threads.findOrCreate({ where: { threadID }, defaults });
      return true;
    } catch (error) {
      console.error('[Threads.createData]', error);
      throw error;
    }
  }

  return {
    getInfo, getAll, getData, setData, delData, createData,
    // Backward-compat aliases
    get: getData,
    set: setData,
  };
}
