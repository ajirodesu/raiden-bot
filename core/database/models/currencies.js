export default function CurrenciesModel({ sequelize, Sequelize }) {
  return sequelize.define('Currencies', {
    num: {
      type:          Sequelize.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    userID: {
      type:   Sequelize.BIGINT,
      unique: true,
    },
    money: {
      type:         Sequelize.BIGINT,
      defaultValue: 0,
    },
    exp: {
      type:         Sequelize.BIGINT,
      defaultValue: 0,
    },
    data: {
      type: Sequelize.JSON,
    },
  });
}