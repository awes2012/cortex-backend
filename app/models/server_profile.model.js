
const { Sequelize, DataTypes } = require('sequelize');
module.exports = (sequelize, Sequelize) => {
  const ServerProfile = sequelize.define("server_profile", {

    metricName: {
      type: Sequelize.STRING(40),
      unique: true
    },
    metric: {
      type: Sequelize.FLOAT
    }
  },
  {
  
    timestamps: false,  // disable createdAt, updatedAt
  });
  
  return ServerProfile;
};
