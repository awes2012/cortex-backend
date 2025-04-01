
const { Sequelize, DataTypes } = require('sequelize');
module.exports = (sequelize, Sequelize) => {
  const SpeedBinStat = sequelize.define("speed_bin_stat", {
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
          'receivedItemId',
        ]
      },
      {
        name: 'idx_speedBin',
        fields: [ 
          'speedBinId',
        ]
      },
      {
        name: 'idx_camera_speedBin_receivedItem',
        fields: [
          'cameraId',
          'speedBinId',
          'receivedItemId',
        ]
      }
    ],
    timestamps: false,  // disable createdAt, updatedAt
  });
  

  return SpeedBinStat;
};
