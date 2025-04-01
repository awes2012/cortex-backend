module.exports = (sequelize, Sequelize) => {
  const Plate = sequelize.define("plate", {
   
    
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
    timeZoneOffset_s: {
      type: Sequelize.INTEGER
    },
    epochTime_ms: {
      type: Sequelize.BIGINT
    },
    vehicleClassId: {
      type: Sequelize.INTEGER
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
    plateImageFilename: {
      type: Sequelize.STRING
    },
    irImageFilename: {
      type: Sequelize.STRING
    },
    colImageFilename: {
      type: Sequelize.STRING
    },
    laneId: {
      type: Sequelize.STRING
    },
    offsetEpochTime_s: {
      type: Sequelize.INTEGER
    },
    cameraId: {
      type: Sequelize.INTEGER
    },
  }, {
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

      ],

      timestamps: false,

  });

  return Plate;
};
