module.exports = (sequelize, Sequelize) => {
  const Role = sequelize.define("permissions", {
    name: {
      type: Sequelize.STRING(50),
      allowNull: false,
    },
    description: {
      type: Sequelize.STRING
    },
    deleted: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
  }
  );

  return Role;
};
