import { createRequire } from 'module';
import { resolve } from 'path';

const require    = createRequire(import.meta.url);
const Sequelize  = require('sequelize');

/**
 * Build and return a configured Sequelize instance from config.
 * @param {object} config - Bot config object (needs DATABASE key).
 * @returns {{ sequelize: Sequelize, Sequelize: typeof Sequelize }}
 */
export function createDatabase(config) {
  const DATABASE = config.DATABASE;
  const dialect  = Object.keys(DATABASE)[0];
  const storage  = resolve(process.cwd(), DATABASE[dialect].storage);

  const sequelize = new Sequelize({
    dialect,
    storage,
    pool: {
      max:     20,
      min:      0,
      acquire: 60000,
      idle:    20000,
    },
    retry: {
      match: [/SQLITE_BUSY/],
      name:  'query',
      max:   20,
    },
    logging: false,
    transactionType: 'IMMEDIATE',
    define: {
      underscored:   false,
      freezeTableName: true,
      charset:       'utf8',
      dialectOptions: { collate: 'utf8_general_ci' },
      timestamps:    true,
    },
    sync: { force: false },
  });

  return { sequelize, Sequelize };
}