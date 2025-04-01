const config = require("../config/db.config.js");
const Sequelize = require("sequelize");
const sequelize = new Sequelize(
  config.DB,
  config.USER,
  config.PASSWORD,
  {
    host: config.HOST,
    dialect: config.dialect,
   // operatorsAliases: false,

    //logging: console.log ,  // verbose logging can be helpful
    logging: (sql, queryObject) => {},  // no logging

    pool: {
      max: config.pool.max,
      min: config.pool.min,
      acquire: config.pool.acquire,
      idle: config.pool.idle
    }
  }
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = require("../models/user.model.js")(sequelize, Sequelize);
db.org_role = require("../models/org_role.model.js")(sequelize, Sequelize);
db.permission = require("../models/permission.model.js")(sequelize, Sequelize);
//db.camera_log = require("../models/camera_log.model.js")(sequelize, Sequelize);

const logModels = require("../models/camera_log.model.js")(sequelize, Sequelize);
db.camera_log = logModels.CameraLog;
db.aggregate_camera_log = logModels.AggregateCameraLog;


db.organization = require("../models/organization.model.js")(sequelize, Sequelize);
db.org_contract = require("../models/organization_contract.model.js")(sequelize, Sequelize);
db.camera = require("../models/camera.model.js")(sequelize, Sequelize);
db.tdp = require("../models/tdp.model.js")(sequelize, Sequelize);
db.raw_camera_log = require("../models/raw_camera_log.model.js")(sequelize, Sequelize);
db.plate = require("../models/plate.model.js")(sequelize, Sequelize);
db.received_item = require("../models/received_item.model.js")(sequelize, Sequelize);
db.received_item_stat = require("../models/received_item_stat.model.js")(sequelize, Sequelize);
db.violation_review = require("../models/violation_review.model.js")(sequelize, Sequelize);

db.speed_bin = require("../models/speed_bin.model.js")(sequelize, Sequelize);
db.speed_bin_stat = require("../models/speed_bin_stat.model.js")(sequelize, Sequelize);

db.speed_stat = require("../models/speed_stat.model.js")(sequelize, Sequelize);

//db.org_plate = require("../models/org_plate.model.js")(sequelize, Sequelize);
//db.org_plate_match = require("../models/org_plate_match.model.js")(sequelize, Sequelize);

//db.org_tdp = require("../models/org_tdp.model.js")(sequelize, Sequelize);
//db.org_tdp_match = require("../models/org_tdp_match.model.js")(sequelize, Sequelize);

db.server_profile = require("../models/server_profile.model.js")(sequelize, Sequelize);

db.org_role.belongsToMany(db.permission, {
  through: "role_permissions",
  foreignKey: "roleId",
  otherKey: "permissionId"
});
db.permission.belongsToMany(db.org_role, {
  through: "role_permissions",
  foreignKey: "permissionId",
  otherKey: "roleId"
});
db.org_role.belongsToMany(db.user, {
  through: "user_roles",
  foreignKey: "roleId",
  otherKey: "userId"
});
db.user.belongsToMany(db.org_role, {
  through: "user_roles",
  foreignKey: "userId",
  otherKey: "roleId"
});

db.org_contract.belongsTo(db.organization);
db.org_role.belongsTo(db.organization);
db.user.belongsTo(db.organization);
db.user.belongsTo(db.org_contract);

db.camera.belongsTo(db.organization);  
db.organization.hasMany(db.camera);  
db.organization.hasMany(db.org_role);  
db.organization.hasMany(db.user);  
 // optional organization contract (eg. InsegVial, Quito)
db.camera.belongsTo(db.org_contract); 

db.camera_log.belongsTo(db.camera);
db.raw_camera_log.belongsTo(db.camera);
db.aggregate_camera_log.belongsTo(db.camera);
db.tdp.belongsTo(db.camera);
//db.plate.belongsTo(db.camera);  // June 2024 plate table is partitioned - no foreign keys allowed

db.received_item_stat.belongsTo(db.received_item);
db.received_item.hasOne(db.received_item_stat);
db.received_item_stat.belongsTo(db.camera);

db.violation_review.belongsTo(db.tdp);
db.tdp.hasMany(db.violation_review, { foreignKey: 'tdpId' });  // MK Oct 18

db.speed_bin_stat.belongsTo(db.received_item);
db.speed_bin_stat.belongsTo(db.speed_bin);
db.speed_bin_stat.belongsTo(db.camera);

db.speed_stat.belongsTo(db.received_item);
db.speed_stat.belongsTo(db.camera);

//db.org_plate.belongsTo(db.organization);
//db.org_tdp.belongsTo(db.organization);

module.exports = db;
