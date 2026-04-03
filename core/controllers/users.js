/**
 * Users controller — wraps Sequelize operations for the Users table.
 */
export default function UsersController({ models, api }) {
  const Users = models.use('Users');

  async function getInfo(id) {
    return (await api.getUserInfo(id))[id];
  }

  async function getNameUser(id) {
    try {
      if (global.data.userName.has(id)) return global.data.userName.get(id);
      if (global.data.allUserID.includes(id)) {
        const row = await getData(id);
        return row?.name || 'Facebook User';
      }
      return 'Facebook User';
    } catch {
      return 'Facebook User';
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
      return (await Users.findAll({ where, attributes })).map(e => e.get({ plain: true }));
    } catch (error) {
      console.error('[Users.getAll]', error);
      throw error;
    }
  }

  async function getData(userID) {
    try {
      const row = await Users.findOne({ where: { userID } });
      return row ? row.get({ plain: true }) : false;
    } catch (error) {
      console.error('[Users.getData]', error);
      throw error;
    }
  }

  async function setData(userID, options = {}) {
    if (typeof options !== 'object' || Array.isArray(options))
      throw new Error('setData: options must be a plain object.');
    try {
      const row = await Users.findOne({ where: { userID } });
      if (row) await row.update(options);
      else await createData(userID, options);
      return true;
    } catch (error) {
      console.error('[Users.setData]', error);
      throw error;
    }
  }

  async function delData(userID) {
    try {
      const row = await Users.findOne({ where: { userID } });
      if (row) await row.destroy();
      return true;
    } catch (error) {
      console.error('[Users.delData]', error);
      throw error;
    }
  }

  async function createData(userID, defaults = {}) {
    if (typeof defaults !== 'object' || Array.isArray(defaults))
      throw new Error('createData: defaults must be a plain object.');
    try {
      await Users.findOrCreate({ where: { userID }, defaults });
      return true;
    } catch (error) {
      console.error('[Users.createData]', error);
      throw error;
    }
  }

  return { getInfo, getNameUser, getAll, getData, setData, delData, createData };
}