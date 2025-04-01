module.exports = (sequelize, Sequelize) => {
  const TDP = sequelize.define("tdp", {
   
    id: {
      type: Sequelize.BIGINT.UNSIGNED,
      primaryKey: true,
      allowNull: false,
      unique: true,
      autoIncrement: true
    },
    
    storageLocation: {
      type: Sequelize.STRING
    },
    latitude: {
      type: Sequelize.FLOAT
    },
    longitude: {
      type: Sequelize.FLOAT
    },
    epochTime_ms: {
      type: Sequelize.BIGINT
    },
    timeZoneOffset_s: {
      type: Sequelize.INTEGER
    },
    violationType: {
      type: Sequelize.STRING(20)
    },
    plateRead: {
      type: Sequelize.STRING(20)
    },
    speed_kph: {
      type: Sequelize.FLOAT
    },
    speedUncertainty_kph: {
      type: Sequelize.FLOAT
    },
    speedLimit_kph: {
      type: Sequelize.INTEGER
    },
    gpsSpeed_kph: {
      type: Sequelize.FLOAT
    },
    vehicleClass: {
      type: Sequelize.STRING(20)
    },
    lane: {
      type: Sequelize.STRING(20)
    },
    trigger: {
      type: Sequelize.STRING(20)
    },
    blackListMatchPlate: {
      type: Sequelize.STRING(20)
    },
    blackListMatchDetails: {
      type: Sequelize.STRING
    },
    irVideoFilename: {
      type: Sequelize.STRING
    },
    colorVideoFilename: {
      type: Sequelize.STRING
    },
    offsetEpochTime_s: {
      type: Sequelize.BIGINT  // ***Change to Integer
    },
  },

  {
    timestamps: false,  // disable createdAt, updatedAt

    indexes: [
      
      {
        name: 'idx_cameraId', 
        fields: ['cameraId'], 
      },
      {
        name: 'idx_epochTime_ms', 
        fields: ['epochTime_ms'], 
      },
      {
        name: 'idx_offsetEpochTime', 
        fields: ['offsetEpochTime_s'], 
      },
      {
        name: 'idx_cameraId_epochTime', 
        fields: ['cameraId', 'epochTime_ms'], 
      },
      {
        name: 'idx_cameraId_ofsetEpochTime', 
        fields: ['cameraId', 'offsetEpochTime_s'], 
      },
      {
        name: 'idx_camera_ofset_class', 
        fields: ['cameraId', 'offsetEpochTime_s', 'vehicleClass'],
      },
      {
        name: 'idx_class', 
        fields: ['vehicleClass'], 
      },
      {
        name: 'idx_vio_type', 
        fields: ['violationType'], 
      },
      {
        name: 'idx_cam_vio_veh_off', 
        fields: ['cameraId', 'violationType',  'vehicleClass', 'offsetEpochTime_s'],
      },

    ]

});


  return TDP;
};

