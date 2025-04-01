// MK - Oct 2023
// to archive Violation records (violation_reviews table)
// for each camer, keep latest N records, archive the remainder
// records saved to a different db. Files remain in place. 


const db = require("../models");
const Camera = db.camera;
const TDP = db.tdp;
const fs = require("fs");
const fs_promise = require('fs').promises
var Common = require("../controllers/common.controller.js");


const { Sequelize, Model, DataTypes } = require('sequelize');
const { Log } = require('@app/services/log.service')


const sequelize = new Sequelize('cortexbackups', process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  logging: false
});

// Archive tables to use with cortexbackups db
const TdpArchive = require('../models/tdp_arch.model.js')(sequelize, Sequelize);
const ViolationReviewArchive = require('../models/violation_review_arch.model.js')(sequelize, Sequelize);


//========================================================================================
let numberToKeep = 1000;
let doDeleteViosInTable = false;
let doDeleteTdpsInTable = false;   // will also move folders to Archive
    
const performViolationsBackup = async () => {

    await sequelize.authenticate();
    Log.info('performViolationsBackup - Connection established with cortexbackups.');

    // ** cortexbackups DB must be created manually
    await ViolationReviewArchive.sync({ alter: true });  // This creates the table if it doesn't exist
    await TdpArchive.sync({ alter: true });

    //console.log('Table ensured or created.');


    try {
      
        const cameras = await Camera.findAll();
     
        for (let aCamera of cameras) {
  
            // Find the count of TDP records for the current camera
            const totalTdpCount = await TDP.count({
                where: {
                    cameraId: aCamera.id
                }
            });
      
            // If there are more than numberToKeep records, calculate the number of records to skip
            const offset = totalTdpCount > numberToKeep ? totalTdpCount - numberToKeep : 0;
        
            // If offset is 0, then there are <= numberToKeep records and nothing to do for this camera
            if (offset === 0){
                Log.info("Camera: " + aCamera.id + " No records backed-up.");
                continue;
            } 

            Log.info("Camera " + aCamera.id + " Begin Backup ---------");
      
            // Fetch all but the latest numberToKeep TDP records along with their associated ViolationReview records
            const tdps = await TDP.findAll({
                where: {cameraId: aCamera.id},
                include: [{model: db.violation_review, required: false }],
                order: [["id", "ASC"]],
                limit: offset
            });
      
          
            let violationReviews = [];
       
            for (let aTdp of tdps) {
                
              if( (aTdp.violation_reviews === null) || (aTdp.violation_reviews.length == 0)) continue;

              for (let review of aTdp.violation_reviews) {

                  violationReviews.push(review);    
              }
            }

            await writeViolationArchiveRecords(violationReviews);

            // will error if attempting to add duplicates
            await writeTdpArchiveRecords(tdps, aCamera.organizationId);

            // Ensure backup was successful before proceeding with deletion
            if(doDeleteViosInTable){

                const violationReviewIds = violationReviews.map(review => review.id);
                await db.violation_review.destroy({
                    where: {
                        id: {
                            [Sequelize.Op.in]: violationReviewIds
                        }
                    }
                });

                Log.info("Deleted " + violationReviews.length + " Violation records from source db");
            }

            if(doDeleteTdpsInTable){

               // Move all TDP-related images to an Archive Folder
              var didArchive = await archiveTDPFolders(tdps);

              if(didArchive){
                const tdpIds = tdps.map(tdp => tdp.id);
                await db.tdp.destroy({
                    where: {
                        id: {
                            [Sequelize.Op.in]: tdpIds
                        }
                    }
                });

                Log.info("Deleted " + tdpIds.length + " TDP records from source db");
              }

            }
          
          // Some TDPs may not have associated Violations (if they have been removed previously)
          Log.info("Camera " + aCamera.id + " End Backup");
        }
    
     //   console.log("performViolationsBackup completed successfully. Total inserted " + vInsert);

    } catch (error) {
        Log.error("Error during Table Management:", error);
    
    } 
    finally {
        await sequelize.close();
        Log.info('performViolationsBackup - Closed cortexbackups database connection.');
    }
}

async function archiveTDPFolders(tdps) {

  Log.info("Archiving " + tdps.length + " TDP Folders");

  var aCounter = 0;
  for (let aTdp of tdps) {

    try {  // Check if the storageLocation exists
      await fs_promise.access(aTdp.storageLocation, fs.constants.F_OK);
    } catch (err) {
      continue;
    }

    try {
      
      // Get the archive path
      const archivePath = await Common.getArchivePath(aTdp.storageLocation);
      
      // Rename (move) the folder
      await fs_promise.rename(aTdp.storageLocation, archivePath);
      ++aCounter;
    } catch (err) {
      // If any error occurs, log it and set success to false
      console.error('Error occurred while moving folder:', err);
      return false;
    }
  }
  
  Log.info("Archived " + aCounter + " Folders");
  
  return true;
}


async function getExistingVioRecords(violation_reviews) {

    Log.info("getExistingVioRecords: " + violation_reviews.length);

    const lookupKeys = violation_reviews.map(record => `${record.tdpId}-${record.stage}`);

    const existingRecords = await ViolationReviewArchive.findAll({
        where: {
            lookupKey: {
                [Sequelize.Op.in]: lookupKeys
            }
        }
    });

    const recordSet = new Set(
        existingRecords.map(rec => `${rec.tdpId}-${rec.stage}`)
    );

    return recordSet;
}


async function getExistingTdpRecords(tdps) {

  Log.info("getExistingTdpRecords: " + tdps.length);

  // Extract the ids from the input tdps array.
  const tdpIds = tdps.map(tdp => tdp.id);

  // Find all records in TdpArchive where the id is in the tdpIds array.
  const existingRecords = await TdpArchive.findAll({
    where: {
      id: {
        [Sequelize.Op.in]: tdpIds  // use the extracted ids here
      }
    }
  });

  // Create a Set containing only the ids for each existing record.
  const idSet = new Set(
    existingRecords.map(rec => rec.id)
  );

  return idSet;

}



async function filterVioNonDuplicates(violation_reviews, existingRecordsSet) {

    Log.info("filterVioNonDuplicates: nMatching = " + existingRecordsSet.size);

    return violation_reviews.filter(record => {
        const key = `${record.tdpId}-${record.stage}`;
        return !existingRecordsSet.has(key);
    });
}


async function filterTdpNonDuplicates(tdps, existingRecordsSet) {
  Log.info("filterTdpNonDuplicates: Number of matching records = " + existingRecordsSet.size);

  // Filter the tdps array, removing any records that have an id present in the existingRecordsSet
  return tdps.filter(record => !existingRecordsSet.has(record.id));
}


// Bulk create with duplicates removed
async function writeTdpArchiveRecords(tdpsToArchive, orgId) {

  try {

      const existingRecordsSet = await getExistingTdpRecords(tdpsToArchive);  // that match violation_reviews
      const nonDuplicateRecords = await filterTdpNonDuplicates(tdpsToArchive, existingRecordsSet);  

      if (nonDuplicateRecords.length) {

          const transformedRecords = nonDuplicateRecords.map(record => ({

            id: record.id,
            storageLocation: record.storageLocation,
            latitude: record.latitude,
            longitude: record.longitude,
            epochTime_ms: record.epochTime_ms,
            timeZoneOffset_s: record.timeZoneOffset_s,
            violationType: record.violationType,
            plateRead: record.plateRead,
            speed_kph: record.tofSpeed_kph,      // tof speed has been renamed to speed_kph
            plateSpeed_kph: record.plateSpeed_kph,  // plateSpeed has been removed
            speedUncertainty_kph: record.speedUncertainty_kph,
            speedLimit_kph: record.speedLimit_kph,
            gpsSpeed_kph: record.gpsSpeed_kph,
            vehicleClass: record.vehicleClass,
            lane: record.lane,
            trigger: record.trigger,
            blackListMatchPlate: record. blackListMatchPlate,
            blackListMatchDetails: record.blackListMatchDetails,
            irVideoFilename: record.irVideoFilename,
            colorVideoFilename: record.colorVideoFilename,
            cameraId: record.cameraId,
            orgId: orgId
              
          }));
          
          await TdpArchive.bulkCreate(transformedRecords);
      }
     
      Log.info(`${nonDuplicateRecords.length} TDP records added to the archive database.`);

  } catch (error) {
      Log.error('Error in writeTdpArchiveRecords:', error);
  }
}


async function writeViolationArchiveRecords(violation_reviews) {

    try {

        const existingRecordsSet = await getExistingVioRecords(violation_reviews);  // that match violation_reviews
        const nonDuplicateRecords = await filterVioNonDuplicates(violation_reviews, existingRecordsSet);  

        if (nonDuplicateRecords.length) {

            const transformedRecords = nonDuplicateRecords.map(record => ({

                stage: record.stage,
                timeBeginReview: record.timeBeginReview,
                timeEndReview: record.timeEndReview,
                plateRead: record.plateRead,
                action: record.action,
                ir_image_pan_x: record.ir_image_pan_x,
                ir_image_pan_y: record.ir_image_pan_y,
                ir_image_scale: record.ir_image_scale,
                ir_image_bright: record.ir_image_bright,
                ir_image_contrast: record.ir_image_contrast,
                col_image_pan_x: record.col_image_pan_x,
                col_image_pan_y: record.col_image_pan_y,
                col_image_scale: record.col_image_scale,
                col_image_bright: record.col_image_bright,
                col_image_contrast: record.col_image_contrast,
                tdpId: record.tdpId,
                pdf_filename: record.pdf_filename,
                notes: record.notes,
                dmv_result: record.dmv_result,
                createdAt: record.createdAt,
                lookupKey: `${record.tdpId}-${record.stage}`
                
            }));
            

            await ViolationReviewArchive.bulkCreate(transformedRecords);
        }
       

        Log.info(`${nonDuplicateRecords.length} Violation records added to the backup database.`);

    } catch (error) {
        Log.error('Error in writeViolationArchiveRecords:', error);
    }
}
  

// Extract from folder path
function extractMacAddress(path) {
  // This regex matches a sequence starting with 'f8dc' followed by 8 hexadecimal characters
  const macAddressRegex = /f8dc[0-9a-fA-F]{8}/;
  const match = path.match(macAddressRegex);

  // If a match is found, insert colons every two characters
  if (match) {
    return match[0].replace(/(.{2})(?=.)/g, '$1:');
  } else {
    return null; // Returns null if no MAC address is found
  }
}



async function limitConcurrency(tasks, concurrencyLimit) {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);

    if (concurrencyLimit <= tasks.length) {
      const e = p.then(() => executing.delete(e));
      executing.add(e);
      if (executing.size >= concurrencyLimit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

// Used only once to fix TDP archive.
// This provides a very fast way to update TDP field values
const archiveFillDetails = async () => {
  try {
    await sequelize.authenticate();
    Log.info('archiveFillDetails - Connected to the database.');

    const tdpArchiveRecords = await TdpArchive.findAll();

    var acount = 0;
    const tasks = tdpArchiveRecords.map(aTdp => async () => {
      const aMac = extractMacAddress(aTdp.storageLocation);
      if (!aMac) return null;

      const { cameraId, orgId } = await Common.getCameraAndOrgID(aMac) || {};
      if (cameraId && orgId) {
      ++acount;
      if(acount % 1000 === 0){
        Log.info("  Recd: " + acount);
      }
          return aTdp.update({ cameraId, orgId });
        }
      });

    // Limit to N concurrent operations
    await limitConcurrency(tasks, 20);

    Log.info('All TdpArchive records updated.');
  } catch (error) {
    Log.error('An error occurred while updating TdpArchive records:', error);
  }
};


/*  // Slower
const archiveFillDetails = async () => {
  try {
    await sequelize.authenticate();
    Log.info('archiveFillDetails - Connection established with cortexbackups.');

    await TdpArchive.sync({ alter: true });

    const tdpArchiveRecords = await TdpArchive.findAll();

    for (let aTdp of tdpArchiveRecords) {
      const aMac = extractMacAddress(aTdp.storageLocation);

      if (!aMac) continue;

      const ids = await Common.getCameraAndOrgID(aMac);

      if (ids) {
        await aTdp.update({
          cameraId: ids.cameraId,
          orgId: ids.orgId
        });

       // Log.info(`TdpArchive record updated for MAC: ${aMac}`);
      }
    }
  } catch (error) {
    Log.error('archiveFillDetails - An error occurred:', error);
  }
};
*/


module.exports = {
  performViolationsBackup,
  archiveFillDetails
};
