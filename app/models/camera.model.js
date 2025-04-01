module.exports = (sequelize, Sequelize) => {
  const Camera = sequelize.define("camera", {
   
    macAddress: {
      type: Sequelize.STRING(20)
    },
    serialNumber: {
      type: Sequelize.STRING(10)
    },
    name: {  // a location label (eg. Malahat N.)
      type: Sequelize.STRING(50)
    },
    deviceType: {  
      type: Sequelize.STRING(50)
    },
    latitude: {    // latest position 
      type: Sequelize.FLOAT
    },
    longitude: {  
      type: Sequelize.FLOAT
    },
    timeZoneOffset_s: {  // latest timeZone (currently only provided through TDP & Diagnostics)
      type: Sequelize.INTEGER,
      defaultValue: 0
    },
    latestSettings: {  
      type: Sequelize.TEXT('medium')
    },
    sendCommand: {
      type: Sequelize.STRING
    },
    sendSetting: {
      type: Sequelize.STRING
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
 
  },
  {

    indexes: [
      {
        name: 'org_id_indx',
        fields: ['organizationId'],
      },
      {
        name: 'contract_id_indx',
        fields: ['orgContractId'],
      },
      {
        name: 'mac_indx',
        fields: ['macAddress'],
      },
    ],

  });
  


  return Camera;
};
