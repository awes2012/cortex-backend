const db = require("../models");
const Camera = db.camera;
const TDP = db.tdp;
const Plate = db.plate;
const ORG = db.organization;
const path = require('node:path');
const fs = require("fs");
const fs_promise = require('fs').promises

const ReceivedItem = db.received_item;
const ReceivedItemStats = db.received_item_stat;
const SpeedBinStats = db.speed_bin_stat;
const SpeedBins = db.speed_bin;
const SpeedStats = db.speed_stat;
const moment = require('moment');
const { readFileData } = require("../services/file.service");
const Op = db.Sequelize.Op;
const { Log } = require('@app/services/log.service')
const axios = require('axios');
const crypto = require('crypto');
const { getImageBase64FromS3 } = require("@app/services/aws.service");
const xml2js = require('xml2js');


function isValidMac(macAddress) {

  var regex = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/;
  return regex.test(macAddress);  // is mac valid
}

// set through diagnostics and TDP
async function setCameraTimezoneOffset(macAddress, offst_s) {

  if (!isValidMac(macAddress)) {  // is mac valid
    Log.debug("Invalid mac: " + macAddress);
    return;
  }

  Camera.findOne({
    where: {
      macAddress: macAddress
    }
  })
    .then(camera => {

      if (camera) {

        if (camera.timeZoneOffset_s != offst_s) {

          camera.changed('timeZoneOffset_s', true);
          camera.update({
            timeZoneOffset_s: offst_s
          })
        }
      }
    })
}

/*
function findSpeedBinId(speed) {
  return SpeedBins.findOne({
    where: {
      minSpeedIncl: {
        [Op.lte]: speed // less than or equal to speed
      },
      maxSpeedExcl: {
        [Op.gt]: speed // greater than speed
      }
    },
    attributes: ['id'] // Only retrieve the 'id' attribute
  }).then(speedBin => {
    if (speedBin) {
      return speedBin.id;
    } else {
      return null;
    }
  }).catch(error => {
    Log.error('Error:', error);
    return null;
  });
}
*/

async function findSpeedBinId(speed) {

  try {
    const speedBin = await SpeedBins.findOne({
      where: {
        minSpeedIncl: {
          [Op.lte]: speed // less than or equal to speed
        },
        maxSpeedExcl: {
          [Op.gt]: speed // greater than speed
        }
      },
      attributes: ['id'] // Only retrieve the 'id' attribute
    });

    return speedBin ? speedBin.id : null;
  } catch (error) {
    Log.error('Error:', error);
    return null; // Ensure null is returned in case of error to maintain the function's contract
  }
}


async function updateSpeedBinStats(camID, speedAbs, itemID, cameraDateTimeStr) {

  try {
    const speedBinID = await findSpeedBinId(speedAbs);

    if (!speedBinID) {
      Log.debug('No SpeedBin found for the given speed range.');
      return; // Exit the function if no speedBinID is found
    }

    //Log.debug(`SpeedBin found with ID: ${speedBinID}`);

    const aStat = await SpeedBinStats.findOne({
      where: {
        receivedItemId: itemID,
        cameraId: camID,
        speedBinId: speedBinID,
        local_date_hour: cameraDateTimeStr
      }
    });

    if (aStat) {
      // If the stat exists, increment the count
      await aStat.update({
        count: aStat.count + 1
      });
    } else {
      // If the stat doesn't exist, create a new record
      await SpeedBinStats.create({
        cameraId: camID,
        receivedItemId: itemID,
        local_date_hour: cameraDateTimeStr,
        speedBinId: speedBinID,
        count: 1,
      });
    }
  } catch (error) {
    Log.error('Error in updateSpeedBinStats:', error);
    // Handle any error that might occur during the operation
  }
}


/*
function updateSpeedBinStats(camID, speedAbs, itemID, cameraDateTimeStr) {

  findSpeedBinId(speedAbs).then(speedBinID => {

    if (speedBinID) {

      //Log.debug(`SpeedBin found with ID: ${speedBinId}`);

      SpeedBinStats.findOne({
        where: {
          receivedItemId: itemID,
          cameraId: camID,
          speedBinId: speedBinID,
          local_date_hour: cameraDateTimeStr
        }
      })
        .then(aStat => {

          if (aStat) {

            aStat.changed('count', true);
            aStat.update({
              count: aStat.count + 1
            })
          }
          else {

            SpeedBinStats.create({
              cameraId: camID,
              receivedItemId: itemID,
              local_date_hour: cameraDateTimeStr,
              speedBinId: speedBinID,
              count: 1,
            })
          }
        });

    } else {
      Log.debug('No SpeedBin found for the given speed range.');
    }
  });

}
*/


async function updateSpeedStats(camID, speedAbs, itemID, cameraDateTimeStr) {
  try {
    const aStat = await SpeedStats.findOne({
      where: {
        receivedItemId: itemID,
        cameraId: camID,
        local_date_hour: cameraDateTimeStr
      }
    });

    if (aStat) {
      // Existing record found, update it
      const vMax = Math.max(aStat.max, speedAbs);
      const vMin = Math.min(aStat.min, speedAbs);

      await aStat.update({
        count: aStat.count + 1,
        sumSpeeds: aStat.sumSpeeds + speedAbs,
        max: vMax,
        min: vMin
      });
    } else {
      // No record found, create a new one
      await SpeedStats.create({
        cameraId: camID,
        receivedItemId: itemID,
        local_date_hour: cameraDateTimeStr,
        count: 1,
        sumSpeeds: speedAbs,
        min: speedAbs,
        max: speedAbs
      });
    }
  } catch (error) {
    Log.error('Error updating speed stats:', error);
    // Handle errors that might occur during the findOne or update/create operations
  }
}

/*
function updateSpeedStats(camID, speedAbs, itemID, cameraDateTimeStr) {


  SpeedStats.findOne({
    where: {
      receivedItemId: itemID,
      cameraId: camID,
      local_date_hour: cameraDateTimeStr
    }
  })
    .then(aStat => {

      if (aStat) {

        vMax = Math.max(aStat.max, speedAbs);
        vMin = Math.min(aStat.min, speedAbs);

        aStat.changed('count', true);
        aStat.update({
          count: aStat.count + 1,
          sumSpeeds: aStat.sumSpeeds + speedAbs,
          max: vMax,
          min: vMin
        })
      }
      else {

        SpeedStats.create({
          cameraId: camID,
          receivedItemId: itemID,
          local_date_hour: cameraDateTimeStr,
          count: 1,
          sumSpeeds: speedAbs,
          min: speedAbs,
          max: speedAbs
        })
      }
    });
}
*/

async function updatePlateSpeedStats(camID, speed, vehicleClass, laneNumb, timestamp) {

  if (Math.abs(speed) < 0.5) return;

    const timeZoneOffset_s = await getCameraTimezoneOffset(camID);

    itemID = await getReceivedItemId("Plate", vehicleClass, "", laneNumb);


    let { sDate, sHours } = getDateTimeFromOffset(timestamp, timeZoneOffset_s);
    var cameraDateTimeStr = sDate + " " + sHours + ":00:00";

    // For now deal only with positive speeds
    let speedAbs = Math.abs(speed)

    await updateSpeedBinStats(camID, speedAbs, itemID, cameraDateTimeStr);

    await updateSpeedStats(camID, speedAbs, itemID, cameraDateTimeStr);

}


async function updateItemStats(camID, itemType, vehicleClass, vioType, laneNumb, timestamp) {
  try {
    const timeZoneOffset_s = await getCameraTimezoneOffset(camID);
    const itemID = await getReceivedItemId(itemType, vehicleClass, vioType, laneNumb);

    if (itemID === null) return;

    let { sDate, sHours } = getDateTimeFromOffset(timestamp, timeZoneOffset_s);
    var cameraDateTimeStr = `${sDate} ${sHours}:00:00`;

    const aStat = await ReceivedItemStats.findOne({
      where: {
        receivedItemId: itemID,
        cameraId: camID,
        local_date_hour: cameraDateTimeStr
      }
    });

    if (aStat) {
      // If aStat exists, update it
      await aStat.update({
        count: aStat.count + 1
      });
    } else {
      // If aStat doesn't exist, create a new record
      await ReceivedItemStats.create({
        cameraId: camID,
        receivedItemId: itemID,
        local_date_hour: cameraDateTimeStr,
        count: 1,
      });
    }
  } catch (error) {
    // Handle any errors that might occur during the process
    console.error("Error updating item stats:", error);
    // Depending on your error handling strategy, you might want to rethrow the error or handle it differently
  }
}

/*
async function updateItemStats(camID, itemType, vehicleClass, vioType, laneNumb, timestamp) {

  const timeZoneOffset_s = await getCameraTimezoneOffset(camID);

  const itemID = await getReceivedItemId(itemType, vehicleClass, vioType, laneNumb)

  if (itemID === null) return;

      let { sDate, sHours } = getDateTimeFromOffset(timestamp, timeZoneOffset_s);
      var cameraDateTimeStr = sDate + " " + sHours + ":00:00";

      ReceivedItemStats.findOne({
        where: {
          receivedItemId: itemID,
          cameraId: camID,
          local_date_hour: cameraDateTimeStr
        }
      })
        .then(aStat => {

          if (aStat) {

            aStat.changed('count', true);
            aStat.update({
              count: aStat.count + 1
            })
          }
          else {

            ReceivedItemStats.create({
              cameraId: camID,
              receivedItemId: itemID,
              local_date_hour: cameraDateTimeStr,
              count: 1,
            })
          }
        });
    });

}
*/



/*
function getReceivedItemId(itemType, vehicleClass, vioType, laneNumb, callback) {

  if (laneNumb == null) {
    var ss = 2;
  }

  ReceivedItem.findOne({
    where: {
      itemName: itemType,
      vehicleClass: vehicleClass,
      violationType: vioType,
      laneNumber: laneNumb,
    }
  })
    .then(anItem => {

      if (anItem) {

        callback(anItem.id);

      }
      else {
        ReceivedItem.create({
          itemName: itemType,
          vehicleClass: vehicleClass,
          violationType: vioType,
          laneNumber: laneNumb,

        })
          .then(result => {
            callback(result.id);
          });
      }

    });
}
*/

/*
function getReceivedItemId(itemType, vehicleClass, vioType, laneNumb, callback) {

  if (laneNumb.length > 1) {
    Log.debug("Invalid laneNumb: " + laneNumb);
    callback(null);
    return;
  }

  ReceivedItem.findOrCreate({
    where: {
      itemName: itemType,
      vehicleClass: vehicleClass,
      violationType: vioType,
      laneNumber: laneNumb,
    },
    defaults: {
      itemName: itemType,
      vehicleClass: vehicleClass,
      violationType: vioType,
      laneNumber: laneNumb,
    }
  })
    .then(([anItem, created]) => {   // Replaced .spread with .then and used array destructuring
      callback(anItem.id);
    })
    .catch(error => {
      console.error('Error in getReceivedItemId:', error);
      callback(null);
    });

}
*/

async function getReceivedItemId(itemType, vehicleClass, vioType, laneNumb) {

  if (laneNumb.length > 1) {
    Log.debug("Invalid laneNumb: " + laneNumb);
    return null; // Return null directly without using a callback
  }

  try {
    const [anItem, created] = await ReceivedItem.findOrCreate({
      where: {
        itemName: itemType,
        vehicleClass: vehicleClass,
        violationType: vioType,
        laneNumber: laneNumb,
      },
      defaults: {
        itemName: itemType,
        vehicleClass: vehicleClass,
        violationType: vioType,
        laneNumber: laneNumb,
      }
    });
    return anItem.id; // Return the item ID directly

  } catch (error) {
    console.error('Error in getReceivedItemId:', error);
    return null; // Return null in case of error
  }
}

async function getCameraTimezoneOffset(idCamera) {
  try {
    const camera = await Camera.findByPk(idCamera);

    if (camera) {
      return camera.timeZoneOffset_s;
    } else {
      return 0;
    }
  } catch (error) {
    // Handle any errors that might occur during the findByPk operation
    console.error("An error occurred:", error);
    return 0;
  }
}

/*
function getCameraTimezoneOffset(idCamera, callback) {

  Camera.findByPk(idCamera)
    .then(camera => {

      if (camera) {
        callback(camera.timeZoneOffset_s);
      }
      else {
        callback(0);
      }
    })
}
*/


// Save latest settings to db.
async function updateCameraSettings(macAddress, jsonSettings) {

  if (!isValidMac(macAddress)) {  // Check if the MAC address is valid
    Log.debug("updateCameraSettings Invalid mac: " + macAddress);
    return;
  }

  try {
    const camera = await Camera.findOne({
      where: {
        macAddress: macAddress
      }
    });

    if (camera) {
      // Flag the 'latestSettings' field as changed
      // Then update the camera with the new settings
      await camera.update({
        latestSettings: jsonSettings
      });
    }
  } catch (error) {
    // Handle any errors that might occur during the findOne or update operation
    console.error('Error updating camera settings:', error);
  }
}

/*
function updateCameraSettings(macAddress, jsonSettings) {

  if (!isValidMac(macAddress)) {  // is mac valid
    Log.debug("updateCameraSettings Invalid mac: " + macAddress);
    return;
  }

  Camera.findOne({
    where: {
      macAddress: macAddress
    }
  })
    .then(camera => {

      if (camera) {

        camera.changed('latestSettings', true);
        camera.update({
          latestSettings: jsonSettings

        })
      }
    })
}
*/

async function getCameraSerialNumber(macAddress) {

  const currentTime = Date.now();

  const hash = crypto.createHash('sha1')
    .update(currentTime + '576fhgfhFHGFH46546$%$')
    .digest('hex');

  const last10Hash = hash.slice(-10);

  const data = {
    macAddress: macAddress,
    time: currentTime,
    hid: last10Hash
  };
  try {
    const res = await axios.post('https://update.viionsystems.com/updateBackend/getSerial.php', null, { params: data })

    if (res.status !== 200) {
      // Handle non-success status codes
      console.error(`getCameraSerialNumber: Request failed with status: ${res.status}`);
      return null;
    }

     // Check for XML response
    if (res.headers['content-type'] === 'application/xml' || res.data.startsWith('<?xml')) {

      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(res.data);
      
      if (result.download && result.download.download_error) {
        console.error('Download error:', result.download.download_error[0]);
        return null;
      }

       
      if (result.download.serial_number && Array.isArray(result.download.serial_number) && result.download.serial_number.length > 0) {
        // Return the first element of the serial_number array
        return result.download.serial_number[0];
      } else {
        console.error('Serial number not found or is in an unexpected format');
        return null;
      }
    
    }

    return null;

  } catch (error) {
    console.error(error);
    return null
  }
}


// Update camera record or add a new one 


async function updateCameraRecord(macAddress, cameraType, latitude, longitude) {

  if (!isValidMac(macAddress)) {
    Log.debug("Invalid mac: " + macAddress);
    throw new Error("Invalid mac: " + macAddress);
  }

  try {
    
    const camera = await Camera.findOne({ where: { macAddress: macAddress } });

    if (camera) {
      const updateData = {
        updatedAt: new Date(),
        latitude: latitude,
        longitude: longitude,
      };

      if ((cameraType != "Unknown") && (camera.deviceType != cameraType)) {
        updateData.deviceType = cameraType;
      }

      if (!camera.serialNumber || camera.serialNumber.length < 4) {
        const serNumb = await getCameraSerialNumber(macAddress);

        if (serNumb && serNumb.length > 3 && serNumb.length < 10) {
          updateData.serialNumber = serNumb;
        }
      }

      await camera.update(updateData);
      return { camID: camera.id, timeZoneOffset_s: camera.timeZoneOffset_s };
    } else {
      const result = await Camera.create({
        macAddress: macAddress,
        deviceType: cameraType,
        latitude: latitude,
        longitude: longitude,
      });
      return { camID: result.id, timeZoneOffset_s: 0 };
    }
  } catch (error) {
    Log.debug("Database error: " + error.message);
    throw error;
  }
}


/*  < Mar 15, 2024
const updateCameraRecord = async (macAddress, cameraType, latitude, longitude) => {
  return new Promise(async (resolve, reject) => {

    if (!isValidMac(macAddress)) {  // is mac valid
      Log.debug("Invalid mac: " + macAddress);
      reject(new Error("Invalid mac: " + macAddress));
      return;
    }

    try {
      const camera = await Camera.findOne({
        where: { macAddress: macAddress }
      });

      if (camera) {
        const updateData = {
          updatedAt: new Date(),
          latitude: latitude,
          longitude: longitude
        };

        if ((cameraType != "Unknown") && (camera.deviceType != cameraType)) {
          updateData.deviceType = cameraType;
        }

        if (!camera.serialNumber || camera.serialNumber.length < 4) {
          const serNumb = await getCameraSerialNumber(macAddress);
        
          if (serNumb && serNumb.length > 3 && serNumb.length < 10) {
            updateData.serialNumber = serNumb;
          }
        }

        await camera.update(updateData);
        resolve({ camID: camera.id, timeZoneOffset_s: camera.timeZoneOffset_s });


      } else {
        const result = await Camera.create({
          macAddress: macAddress,
          deviceType: cameraType,
          latitude: latitude,
          longitude: longitude
        });
        resolve({ camID: result.id, timeZoneOffset_s: 0 });
      }
    } catch (error) {
      Log.debug("Database error: " + error.message);
      reject(error);
    }
  });
};
*/


/*
function updateCameraRecord(macAddress, cameraType, lati, longi, callback) {


  if (!isValidMac(macAddress)) {  // is mac valid
    Log.debug("Invalid mac: " + macAddress);
    return;
  }

  // See if unit listed in camera table, if not add a record
  Camera.findOne({
    where: {
      macAddress: macAddress
    }
  })
    .then(camera => {

      if (camera) {

        // Device type may change - record the latest
        if ((cameraType != "Unknown") && (camera.deviceType != cameraType)) {
          camera.changed('updatedAt', true);
          camera.changed('deviceType', true);
          camera.changed('latitude', true);
          camera.changed('longitude', true);
          camera.update({
            updatedAt: new Date(),
            deviceType: cameraType,
            latitude: lati,
            longitude: longi
          })
        }
        else {
          camera.changed('updatedAt', true);
          camera.changed('latitude', true);
          camera.changed('longitude', true);
          camera.update({
            updatedAt: new Date(),
            latitude: lati,
            longitude: longi
          })
        }

        // MK test - this extracts the settings into a dictionary 
        // let obj = JSON.parse(camera.latestSettings);

        callback(camera.id, camera.timeZoneOffset_s);

      }
      else {  // create new camera record
        Camera.create({
          macAddress: macAddress,
          deviceType: cameraType,
          latitude: lati,
          longitude: longi
        })
          .then(result => {

            // Log.debug("New Camera: " + result.id);
            callback(result.id, 0);
          });
      }
    })

}
*/

async function getCameraID(macAddress) {
  try {
    const camera = await Camera.findOne({
      where: {
        macAddress: macAddress
      }
    });

    if (camera) {
      return camera.id;
    } else {
      Log.debug("getCameraID - Unable to find mac: " + macAddress);
      return null; // Explicitly return null if the camera is not found
    }
  } catch (error) {
    // Handle any errors that might occur during the database query
    console.error("Error in getCameraID:", error);
    throw error; // Rethrow or handle the error as appropriate for your use case
  }
}

/*
function getCameraID(macAddress, callback) {

  // See if unit listed in camera table, if not add a record
  Camera.findOne({
    where: {
      macAddress: macAddress
    }
  })
    .then(camera => {

      if (camera) {
        callback(camera.id);
      }
      else {
        Log.debug("getCameraID - Unable to find mac: " + macAddress);
      }
    })
}
*/


async function getCameraAndOrgID(macAddress) {
  
  const camera = await Camera.findOne({
    where: { macAddress: macAddress }
  });

  if (camera) {
    return { cameraId: camera.id, orgId: camera.organizationId };
  } else {
    Log.debug(`Unable to find mac: ${macAddress}`);
    return null;
  }
}

function removeLastFolderFromPath(originalPath) {
  const segments = originalPath.split(path.sep);
  segments.pop(); // Remove last segment
  return segments.join(path.sep);
}

// /var/www/cortexData/f8dc7aac9ae8/2023-09-06/H23/triggerpacket_1694042435367
async function getArchivePath(currStorageLocn) {

  var prefixPath = path.normalize(
    process.env.STORE_ROOT
  );

  var fullArchivePath = path.normalize(process.env.ARCHIVE_ROOT + currStorageLocn.substring(prefixPath.length));

  var archiveRoot = removeLastFolderFromPath(fullArchivePath);

  if (!fs.existsSync(archiveRoot)) {
    await fs_promise.mkdir(archiveRoot, { recursive: true });
  }

  return fullArchivePath;

}

async function getCurrentStoragePath(macAddress) {

  var macPath = macAddress.replace(/:/g, "");

  const d = new Date();

  // date/time is based on Server Location  
  const year = d.getFullYear();
  const month = ('0' + (d.getMonth() + 1)).slice(-2);
  const day = ('0' + d.getDate()).slice(-2);
  const hour = ('0' + d.getHours()).slice(-2);

  let sDate = year + '-' + month + '-' + day;

  //var path = require("path");

  var correctPath = path.normalize(
    process.env.STORE_ROOT + "/" + macPath + "/" + sDate + "/H" + hour + "/"
  );


  if (!fs.existsSync(correctPath)) {
    await fs_promise.mkdir(correctPath, { recursive: true });
  }

  return correctPath;
}



function getDateTimeFromOffset(timestamp, timeZoneOffset_s) {
  // Some juggling required to get time/date at non-server location
  var tmpDate = new Date(timestamp + (timeZoneOffset_s * 1000));  // artifical local (server) time
  var ISOstring = tmpDate.toISOString();  // to artificial UTC

  var sDate = ISOstring.substring(0, 10);
  var sHours = ISOstring.split('T')[1].split(':')[0];
  var sMinutes = ISOstring.split('T')[1].split(':')[1];
  var sSeconds = ISOstring.split('T')[1].split(':')[2].split('.')[0];

  return { sDate, sHours, sMinutes, sSeconds };
}


// Asynch get all images (thumbnails/plates)
function getAllImages(pathList, callback) {

  var plateImages = [];

  for (var iPath = 0; iPath < pathList.length; iPath++) {
    getImageBase64FromS3(iPath).then((data) => {
      plateImages.push(data);
    }).catch((e) => {
      imageData.pushBack(null);
    }).finally(() => {
      if (plateImages.length === pathList.length) {
        callback(plateImages);
      }
    })
  }
}


async function addTdpPlateImages(tdpRecs) {

  const readImagePromises = tdpRecs.map(async (aTdpRec) => {
    const aPath = path.normalize(`${aTdpRec.dataValues.storageLocation}/plate.png`);
    try {
      const data = await fs.readFile(aPath, { encoding: 'base64' });
      aTdpRec.dataValues.plateImage = data;
    } catch (error) {
      // Handle the error as needed; for now, we'll just log it
      console.error(`Error reading file ${aPath}:`, error);
      // Optionally assign a fallback value or perform other error handling
      aTdpRec.dataValues.plateImage = null;
    }
  });

  // Wait for all readFile operations to complete
  await Promise.all(readImagePromises);

  // Since the function is now async, it returns a promise
  // Therefore, it can be awaited or used with .then() when calling
  return tdpRecs;
}

/*
function addTdpPlateImages(tdpRecs, callback) {

  var aCounter = 0;
  for (const aTdpRec of tdpRecs) {

    const aPath = path.normalize(aTdpRec.dataValues.storageLocation + "/plate.png");

    fs.readFile(aPath, { encoding: 'base64' }, function (error, data) {

      if (error) {

      } else {

        aTdpRec.dataValues.plateImage = data;

      }

      ++aCounter;
      if (aCounter === tdpRecs.length) {
        callback(tdpRecs);
      }
    });
  }
}
*/


// Asynch get all images (thumbnails/plates)
// Add to plate database records

async function addPlateImages(plateRecs) {
  const maxReads = Math.min(100, plateRecs.length);
  const readImagePromises = [];

  for (let i = 0; i < maxReads; i++) {
    const aPath = plateRecs[i].dataValues.storageLocation + "/" + plateRecs[i].dataValues.plateImageFilename;
    // Push each promise to the array
    readImagePromises.push(
      getImageBase64FromS3(aPath)
        .then((data) => {
          plateRecs[i].dataValues.plateImage = data;
        }).catch((e) => {
          // In case of error, set plateImage to null
          plateRecs[i].dataValues.plateImage = null;
        })
    );
  }

  // Wait for all the image read operations to complete
  await Promise.all(readImagePromises);

  // Now all operations are complete, return the updated records
  return plateRecs;
}

/*
function addPlateImages(plateRecs, callback) {

  const maxReads = Math.min(100, plateRecs.length);

  var aCounter = 0;

  for (let i = 0; i < maxReads; i++) {

    //  var aPlateRec = plateRecs[i];

    const aPath = plateRecs[i].dataValues.storageLocation + "/" + plateRecs[i].dataValues.plateImageFilename;
    getImageBase64FromS3(aPath).then((data) => {
      plateRecs[i].dataValues.plateImage = data;
    }).catch((e) => {
      plateRecs[i].dataValues.plateImage = null;
    }).finally(() => {
      ++aCounter;
      if (aCounter === maxReads) {   // **** To revise with pagination
        callback(plateRecs);
      }
    })
  }
}
*/

async function getCameraWebLink(macAddress) {

  const currentTime = Date.now();

  const hash = crypto.createHash('sha1')
    .update(currentTime + '6gU3#54sd!TRE')
    .digest('hex');

  const last10Hash = hash.slice(-10);

  const data = {
    macAddress: macAddress,
    time: currentTime,
    hid: last10Hash
  };
  try {
    const res = await axios.post('https://update.viionsystems.com/updateBackend/getLink.php', null, { params: data })
    return res.data;

  } catch (error) {
    console.error(err);
    return null
  }
}



module.exports = {
  getCameraID,
  isValidMac,
  setCameraTimezoneOffset,
  getCurrentStoragePath,
  updateCameraRecord,
  getDateTimeFromOffset,
  getCameraTimezoneOffset,
  getAllImages,
  addTdpPlateImages,
  addPlateImages,
  getReceivedItemId,
  updateItemStats,
  updatePlateSpeedStats,
  updateCameraSettings,
  getCameraWebLink,
  getArchivePath,
  getCameraAndOrgID
}