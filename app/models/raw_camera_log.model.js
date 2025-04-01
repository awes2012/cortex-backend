module.exports = (sequelize, Sequelize) => {
  const RawCameraLog = sequelize.define("raw_camera_log", {
   
    log: {
      type: Sequelize.TEXT('long')
    },
    
  });

  return RawCameraLog;
};
