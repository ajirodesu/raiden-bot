export default function ThreadsModel({ sequelize, Sequelize }) {
  return sequelize.define('Threads', {
    num: {
      type:          Sequelize.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    threadID: {
      type:   Sequelize.BIGINT,
      unique: true,
    },
    threadInfo: {
      type: Sequelize.JSON,
    },
    data: {
      type: Sequelize.JSON,
    },
    // Dedicated column for per-group custom prefix (null = use global)
    prefix: {
      type:         Sequelize.STRING(10),
      defaultValue: null,
      allowNull:    true,
    },
  });
}