
const { Sequelize, DataTypes } = require('sequelize');
module.exports = (sequelize, Sequelize) => {
  const SpeedStat = sequelize.define("speed_stat", {
    local_date_hour: {  // local means at the camera location
      type: Sequelize.STRING(50)
    },
    count: {
      type: Sequelize.INTEGER
    },
    min: {
      type: Sequelize.FLOAT
    },
    max: {
      type: Sequelize.FLOAT
    },

    sumSpeeds: {
      type: Sequelize.FLOAT
    }

  },
  
  {
    indexes: [

      {
        name: 'idx_receivedItem',
        fields: [
    
          'receivedItemId',
        ]
      },
      {
        name: 'idx_cameraId',
        fields: [
          'cameraId',
        ]
      },
      {
        name: 'idx_camera_received_Item',
        fields: [
          'cameraId',
          'receivedItemId',
        ]
      }
    ],
    timestamps: false,  // disable createdAt, updatedAt
  });
  

  return SpeedStat;
};
