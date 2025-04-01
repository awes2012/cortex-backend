module.exports = (sequelize, Sequelize) => {
  const Role = sequelize.define("org_roles", {
    name: {
      type: Sequelize.STRING(50)
    },
    deleted: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
  },
  {
    indexes: [
      {
        name: 'org_id_indx',
        fields: ['organizationId'],
      },
    ],

  });
  


  return Role;
};
