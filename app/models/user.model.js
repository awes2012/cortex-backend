module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define("users", {
    username: {
      type: Sequelize.STRING
    },
    email: {
      type: Sequelize.STRING
    },
    password: {
      type: Sequelize.STRING
    },
    signature_filename: {
      type: Sequelize.STRING
    },
    office_number: {
      type: Sequelize.STRING
    },
    deleted: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    activated: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    password_recover_token: {
      type: Sequelize.STRING
    },
    lastLoggedAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    },
  },
  
  {
    indexes: [
      {
        name: 'org_id_indx',
        fields: ['organizationId'],
      },
      {
        name: 'org_contract_id_indx',
        fields: ['orgContractId'],
      },
    ],

  });
  


  return User;
};
