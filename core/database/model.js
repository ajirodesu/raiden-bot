import UsersModel      from './models/users.js';
import ThreadsModel    from './models/threads.js';
import CurrenciesModel from './models/currencies.js';

/**
 * Sync all models and return a unified accessor.
 * @param {{ sequelize, Sequelize }} input
 * @returns {{ model: object, use: function }}
 */
export default function buildModels(input) {
  const Users      = UsersModel(input);
  const Threads    = ThreadsModel(input);
  const Currencies = CurrenciesModel(input);

  Users.sync({ force: false });
  Threads.sync({ force: false });
  Currencies.sync({ force: false });

  return {
    model: { Users, Threads, Currencies },
    use(modelName) {
      return this.model[modelName];
    },
  };
}