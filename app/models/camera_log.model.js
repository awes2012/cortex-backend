
module.exports = (sequelize, Sequelize) => {
  const defineCameraLog = (tableName) => {
    return sequelize.define(tableName, {
      
      uptime: {
        type: Sequelize.STRING(20)
      },
      ipAddress: {
        type: Sequelize.STRING(20)
      },
      latitude: {
        type: Sequelize.FLOAT
      },
      longitude: {
        type: Sequelize.FLOAT
      },
      speedThresh: {
        type: Sequelize.INTEGER
      },
      timeZoneOffset_s: {
        type: Sequelize.INTEGER
      },
      epochTime_ms: {
        type: Sequelize.BIGINT
      },
      VPNAddress: {
        type: Sequelize.STRING(20)
      },
      IR: {
        type: Sequelize.INTEGER
      },
      Col: {
        type: Sequelize.INTEGER
      },
      TOF: {
        type: Sequelize.INTEGER
      },
      Proc: {
        type: Sequelize.INTEGER
      },
      AI: {
        type: Sequelize.INTEGER
      },
      captLossPerc: {
        type: Sequelize.INTEGER
      },
      cpuTemp: {
        type: Sequelize.INTEGER
      },
      tofSensTemp: {
        type: Sequelize.INTEGER
      },
      fpgaTemp: {
        type: Sequelize.INTEGER
      },
      aiTemp1: {
        type: Sequelize.INTEGER
      },
      aiTemp2: {
        type: Sequelize.INTEGER
      },
      VehiclesPerHour: {
        type: Sequelize.INTEGER
      },
      ViolationsPerHour: {
        type: Sequelize.INTEGER
      },
      voltageSrc: {
        type: Sequelize.FLOAT
      },
      voltage3_3: {
        type: Sequelize.FLOAT
      },
      voltage5_0: {
        type: Sequelize.FLOAT
      },
  
  // Added Oct 31, 2023
      uploadedThisMonth_MB: {
        type: Sequelize.INTEGER
      },
      downloadedThisMonth_MB: {
        type: Sequelize.INTEGER
      },
      completeTdpSent: {
        type: Sequelize.INTEGER
      },
      lostTdpSent: {
        type: Sequelize.INTEGER
      },
      completeMesgSent: {
        type: Sequelize.INTEGER
      },
      lostMesgSent: {
        type: Sequelize.INTEGER
      },
      tofAvgEstErr: {
        type: Sequelize.FLOAT
      },
      avgTdpXferSec: {
        type: Sequelize.FLOAT
      },
      maxTdpXferSec: {
        type: Sequelize.FLOAT
      },
      avgPlateXferSec: {
        type: Sequelize.FLOAT
      },
      maxPlateXferSec: {
        type: Sequelize.FLOAT
      },

    }, {
      timestamps: false,  // disable createdAt, updatedAt

      indexes: [
        {
          name: 'epoch_indx',
          fields: ['epochTime_ms'],
        },
        {
          name: 'cameraId_indx',
          fields: ['cameraId'],
        },
      ],

    });

  };

  // All Foreign key relationships are defined in models/index.js

  // This permits us to use the same model in two tables
  const CameraLog = defineCameraLog("camera_log");
  const AggregateCameraLog = defineCameraLog("aggregate_camera_log");

  // Here, you can also add additional fields to AggregatedCameraLog or 
  // remove fields that are not relevant.

  return {
    CameraLog,
    AggregateCameraLog
  };
};



