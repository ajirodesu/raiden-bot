/**
 * Currencies controller — wraps Sequelize operations for the Currencies table.
 */
export default function CurrenciesController({ models }) {
  const Currencies = models.use('Currencies');

  async function getAll(...data) {
    let where, attributes;
    for (const i of data) {
      if (typeof i !== 'object') throw new Error('getAll: argument must be an object or array.');
      if (Array.isArray(i)) attributes = i;
      else where = i;
    }
    try {
      return (await Currencies.findAll({ where, attributes })).map(e => e.get({ plain: true }));
    } catch (error) {
      console.error('[Currencies.getAll]', error);
      throw error;
    }
  }

  async function getData(userID) {
    try {
      const row = await Currencies.findOne({ where: { userID } });
      return row ? row.get({ plain: true }) : false;
    } catch (error) {
      console.error('[Currencies.getData]', error);
      throw error;
    }
  }

  async function setData(userID, options = {}) {
    if (typeof options !== 'object' || Array.isArray(options))
      throw new Error('setData: options must be a plain object.');
    try {
      const row = await Currencies.findOne({ where: { userID } });
      if (row) await row.update(options);
      else await createData(userID, options);
      return true;
    } catch (error) {
      console.error('[Currencies.setData]', error);
      throw error;
    }
  }

  async function delData(userID) {
    try {
      const row = await Currencies.findOne({ where: { userID } });
      if (row) await row.destroy();
      return true;
    } catch (error) {
      console.error('[Currencies.delData]', error);
      throw error;
    }
  }

  async function createData(userID, defaults = {}) {
    if (typeof defaults !== 'object' || Array.isArray(defaults))
      throw new Error('createData: defaults must be a plain object.');
    try {
      await Currencies.findOrCreate({ where: { userID }, defaults });
      return true;
    } catch (error) {
      console.error('[Currencies.createData]', error);
      throw error;
    }
  }

  async function increaseMoney(userID, amount) {
    if (typeof amount !== 'number') throw new Error('increaseMoney: amount must be a number.');
    try {
      const row = await getData(userID);
      await setData(userID, { money: (row?.money || 0) + amount });
      return true;
    } catch (error) {
      console.error('[Currencies.increaseMoney]', error);
      throw error;
    }
  }

  async function decreaseMoney(userID, amount) {
    if (typeof amount !== 'number') throw new Error('decreaseMoney: amount must be a number.');
    try {
      const row = await getData(userID);
      if ((row?.money || 0) < amount) return false;
      await setData(userID, { money: row.money - amount });
      return true;
    } catch (error) {
      console.error('[Currencies.decreaseMoney]', error);
      throw error;
    }
  }

  return { getAll, getData, setData, delData, createData, increaseMoney, decreaseMoney };
}