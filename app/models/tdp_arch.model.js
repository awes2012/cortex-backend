module.exports = (sequelize, Sequelize) => {
  const TDP_ARCH = sequelize.define("tdp", {
   
    id: {
      type: Sequelize.BIGINT.UNSIGNED,
      primaryKey: true,
      allowNull: false,
      unique: true
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
    tofSpeed_kph: {
      type: Sequelize.FLOAT
    },
    plateSpeed_kph: {
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
    cameraId: {
      type: Sequelize.INTEGER
    },
    orgId: {
      type: Sequelize.INTEGER
    },

  },

  {
    timestamps: false,  // disable createdAt, updatedAt
  });

  return TDP_ARCH;
};

