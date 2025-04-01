// Received Item Stat model - granularity = 1 hour.
const { Sequelize, DataTypes } = require('sequelize');
module.exports = (sequelize, Sequelize) => {
  const ReceivedItemStat = sequelize.define("received_item_stat", {
    local_date_hour: {  // local means at the camera location
      type: Sequelize.STRING(50)
    },
    count: {
      type: Sequelize.INTEGER
    }

  },
  
  {
    indexes: [

      {
        name: 'idx_receivedItem',
        fields: [
          'receivedItemId'
        ]
      },
      
      {
        name: 'idx_cameraId',
        fields: [
          'cameraId',
        ]
      },

      {
        name: 'idx_camera_received',
        fields: [
          'cameraId',
          'receivedItemId'
        ]
      }
    ],
    timestamps: false,  // disable createdAt, updatedAt
  });
  

  return ReceivedItemStat;
};
