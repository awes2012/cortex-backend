
const { Sequelize, DataTypes } = require('sequelize');
module.exports = (sequelize, Sequelize) => {
  const SpeedBin = sequelize.define("speed_bin", {


    minSpeedIncl: {  // included speed
      type: Sequelize.INTEGER
    },

    maxSpeedExcl: {  // < max speed
      type: Sequelize.INTEGER
    }

  },
  
  {
    timestamps: false,  // disable createdAt, updatedAt
  });
  
 



  return SpeedBin;
};
