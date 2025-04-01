


module.exports = (sequelize, Sequelize) => {
  const OrganizationContracts = sequelize.define("org_contract", {
   
    name: {
      type: Sequelize.STRING(50)
    },
    
    deleted: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    createdAt: {
      type: 'TIMESTAMP',
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      
    },
    updatedAt: {
      type: 'TIMESTAMP',
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    nextTicket: {
      type: Sequelize.STRING(50)
    },
    violation_pdf_template: {
      type: Sequelize.TEXT('long')	
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

  return OrganizationContracts;
};