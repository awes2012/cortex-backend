require('module-alias/register');
const express = require("express");
const cors = require("cors");
const { Log } = require('@app/services/log.service');
const https = require("https");
const fs = require("fs");
const dotenv = require('dotenv');
dotenv.config();
const db = require("./app/models");
const { Op } = require('sequelize');
const os = require('os');
const { PORT } = require('@app/config/app.config');

const app = express();

// Middleware
app.use(express.static('public'));  // not sure if this is used
app.use(express.static('uploads'));
app.use(cors()); // Open model
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb', parameterLimit: 50000 }));

// Import services
const performPlateMatching = require('@app/services/plate_match.service');
const { performTdpMatching } = require('@app/services/tdp_match.service');
const createLogAggregate = require('@app/services/log_aggregate.service');
const { performViolationsBackup, archiveFillDetails } = require('@app/services/backup.service');

// Control flags
const doSync = false;
const doPerformBackup = false;
const doFillArchiveOrgAndCameraDetails = false;
const doPlateMatchingBatch = false;
const doTdpMatchingBatch = false;
const doCreateLogAggregate = false;

// Database sync and initialization
const syncAndInitializeDb = async () => {
  if (doSync) {
    try {
      console.info('Begin database sync');
      await db.sequelize.sync({ alter: true });
      //await populateDefaultDbValues();
      console.info('Database synced!');
    } catch (error) {
      Log.error('Error syncing database:', error);
    }
  }

};

// Backup and other manually-initiated tasks
const performTasks = async () => {

  if (doPerformBackup) {
    try {
      await performViolationsBackup();
    } catch (error) {
      console.error("Failed to perform backup:", error);
    }
  }

  if (doFillArchiveOrgAndCameraDetails) {
    try {
      await archiveFillDetails();
    } catch (error) {
      console.error("Failed to archive fill details:", error);
    }
  }

  if (doPlateMatchingBatch) {
    try {
      await performPlateMatching();
    } catch (error) {
      console.error("Failed to perform plate matching:", error);
    }
  }

  if (doTdpMatchingBatch) {
    try {
      await performTdpMatching();
    } catch (error) {
      console.error("Failed to perform TDP matching:", error);
    }
  }

  if (doCreateLogAggregate) {
    try {
      await createLogAggregate();
    } catch (error) {
      console.error("Failed to perform log aggregation:", error);
    }
  }
};

const checkIfTableExists = async (tableName) => {
  try {
    const queryInterface = db.sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    return tables.includes(tableName);
  } catch (error) {
    console.error('Error checking if table exists:', error);
    return false;
  }
};

// MySQL does not permit foreign keys when partitioning a table.
// cameraId is used but not as a foreign key
const createPlateTable = async () => {

  const query = `
    CREATE TABLE IF NOT EXISTS plates (
      id BIGINT UNSIGNED AUTO_INCREMENT,
      storageLocation VARCHAR(255),
      latitude FLOAT,
      longitude FLOAT,
      timeZoneOffset_s INT,
      epochTime_ms BIGINT,
      vehicleClassId INT,
      plateRead VARCHAR(20),
      speed_kph FLOAT,
      speedUncertainty_kph FLOAT,
      plateImageFilename VARCHAR(255),
      irImageFilename VARCHAR(255),
      colImageFilename VARCHAR(255),
      laneId VARCHAR(255),
      offsetEpochTime_s INT,
      cameraId INT,
      PRIMARY KEY (id, cameraId, vehicleClassId),
      INDEX idx_cameraId (cameraId),
      INDEX idx_epochTime_ms (epochTime_ms),
      INDEX idx_offsetEpochTime (offsetEpochTime_s),
      INDEX idx_cameraId_epochTime (cameraId, epochTime_ms),
      INDEX idx_cameraId_offsetEpochTime (cameraId, offsetEpochTime_s),
      INDEX idx_camera_offset_class (cameraId, offsetEpochTime_s, vehicleClassId)
    )
      PARTITION BY KEY(cameraId,vehicleClassId) PARTITIONS 100;
  `;

  try {
    await db.sequelize.query(query);
    Log.info(`Table "plates" created with 100 partitions using KEY(cameraId,vehicleClassId).`);
  } catch (error) {
    Log.error('Error creating "plates" table:', error);
  }
};




// Initialize and perform tasks -------------------------------
(async () => {

  if (doSync) {
    await syncAndInitializeDb();
  }

  await performTasks();

  // Plates table with partitioning - can't be created using sequelize
  const tableExists = await checkIfTableExists('plates');
  if (!tableExists) {
    await createPlateTable();
  }

 // const vehTableExists = await checkIfTableExists('vehicle_class');
 // if (!vehTableExists) {
 //   await createVehicleClassTable();
 // }

})();
//-----------------------------------------------------------


// Simple route
app.get("/", (req, res) => {
  res.json({ message: "Welcome." });
});

// Set headers for all routes
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Headers", "x-access-token, Origin, Content-Type, Accept");
  next();
});

// Import routes
require('./app/routes/auth.routes')(app);
require('./app/routes/user.routes')(app);
require('./app/routes/violation.routes')(app);
require('./app/routes/camera.routes')(app);
require('./app/routes/receive_tdp.routes')(app);
require('./app/routes/receive_plate.routes')(app);
require('./app/routes/received_item.routes')(app);
require('./app/routes/tdp.routes')(app);
require('./app/routes/plate.routes')(app);
require('./app/routes/admin/admin-routes')(app);
require('./app/routes/dashboard/dashboard')(app);
require('./app/routes/common')(app);
require('./app/routes/test.routes')(app);

// Function to get IP address
const getIPAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    for (const alias of interfaces[devName]) {
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '0.0.0.0';
};


const startServer = () => {

  if (process.env.NODE_ENV === 'production') {
    try {
      const sslPath = '/etc/ssl/';
      const privateKey = fs.readFileSync(`${sslPath}private/nginx-selfsigned.key`, 'utf8');
      const certificate = fs.readFileSync(`${sslPath}certs/nginx-selfsigned.crt`, 'utf8');
      const credentials = { key: privateKey, cert: certificate };

      const httpsServer = https.createServer(credentials, app);
      httpsServer.listen(PORT, () => {
        Log.debug(`🚀 App listening on port ${PORT}`);
      });
    } catch (error) {
      Log.debug(`Error ${error}`);
    }
  } else {
    app.listen(PORT, () => {
      Log.debug(`Server is running on port ${PORT} ip: ` + getIPAddress());
    });
  }
};

// Start the server if no tasks need to run
if (!(doPerformBackup || doPlateMatchingBatch || doCreateLogAggregate || doTdpMatchingBatch || doFillArchiveOrgAndCameraDetails)) {
  startServer();
}

