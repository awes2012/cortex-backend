const db = require("../models");
const fs = require("fs");
const fse = require("fs-extra");
const fs_promise = require('fs').promises

const TDP = db.tdp;
var Common = require("./common.controller.js");
const path = require('path');

const { Log } = require('@app/services/log.service')
const { updateTdpMatches } = require('@app/services/tdp_match.service');

const TimeProfiler = require('./time_profiler.js');
const timeProfiler = new TimeProfiler('\x1b[32m%s\x1b[0m', "Avg Receive_TDP Time: ", 50, "TDP_ReceiveTime_ms");




const violation_review = db.violation_review;
const { spawn } = require('child_process');

const sizeOfImage = require('image-size');
const { uploadLocalFileToS3, } = require("@app/services/aws.service");


async function findAndRenameQuipuxFiles(directory) {
  try {

    const entries = await fs_promise.readdir(directory, { withFileTypes: true });

    for (const dirent of entries) {
      const fullPath = path.join(directory, dirent.name);

      if (dirent.isFile()) {

        if (dirent.name.includes('_P1_')) {
          //Log.log(`Found: ${fullPath}`);
          const newFilePath = path.join(directory, 'irFrame.jpg');
          await fs_promise.rename(fullPath, newFilePath);
          //Log.log(`Renamed to: ${newFilePath}`);
        } else if (dirent.name.includes('_P2_')) {
          //Log.log(`Found: ${fullPath}`);
          const newFilePath = path.join(directory, 'colorFrame.jpg');
          await fs_promise.rename(fullPath, newFilePath);
          //Log.log(`Renamed to: ${newFilePath}`);
        }
      }
    }
  } catch (error) {
    Log.error(`Error processing directory ${directory}: ${error.message}`);
  }
}



async function moveFolderContentsToAWS(tempPath, bucketPath) {
  try {
    const files = await fs_promise.readdir(tempPath);
    for (const file of files) {
      const filePath = path.join(tempPath, file); // Make sure to use tempPath instead of directoryPath

      try {
        await uploadLocalFileToS3(filePath, bucketPath + "/" + file);
        
      } catch (err) {
        Log.error('\x1b[33m%s\x1b[0m', "moveFolderToAWS" + err);
        // Consider whether you want to return or just log the error. Returning here might stop the process prematurely.
      }
    }
  } catch (error) {
    console.error('Error reading directory:', error);
  }
}



async function getCurrentStoragePathAWS(macAddress) {

  var macPath = macAddress.replace(/:/g, "");

  const d = new Date();

  // date/time is based on Server Location  
  const year = d.getFullYear();
  const month = ('0' + (d.getMonth() + 1)).slice(-2);
  const day = ('0' + d.getDate()).slice(-2);
  const hour = ('0' + d.getHours()).slice(-2);

  let sDate = year + '-' + month + '-' + day;


  var correctPath = macPath + "/" + sDate + "/H" + hour + "/"


  return correctPath;
}


async function receiveQuipuxPacket(req, res) {

  try {
    // Normalize the temp path
    var tempPath = path.normalize(process.env.STORE_ROOT + "/temp/");


    // Ensure the temp directory exists
    if (!await fs_promise.stat(tempPath).catch(() => false)) {
      await fs_promise.mkdir(tempPath, { recursive: true });
    }

    // Construct the destination file path
    const tempFilename = "triggerPacket_Q_" + Date.now() + ".zip";
    var destPath = path.join(tempPath, tempFilename);

    // Decode the base64 string to binary data
    const fileData = Buffer.from(req.body.fileBase64, 'base64');

    // Write the file to the destination path
    await fs_promise.writeFile(destPath, fileData);

    Log.debug('\x1b[33m%s\x1b[0m', "Quipux TDP written successfully: " + destPath);


    await processZipFile(destPath, res, -1);


    // Respond to the request indicating success
    //res.send({ status: "success", message: "received TDP" });

  } catch (error) {
    console.error("Failed to receive and store file:", error);
    // Respond to the request indicating failure
    res.status(500).send({ status: "error", message: "Failed to save the file" });
  }
}


async function processZipFile(zipPath, res, postedLimit)
{

  try{

    const tempExtractPath = zipPath.replace(".zip", "");

  //  if (!fs.existsSync(tempExtractPath)) {
//      await fs_promise.mkdir(tempExtractPath, { recursive: true });
//    }

    try {
      await fs_promise.access(tempExtractPath);
    } catch {
      await fs_promise.mkdir(tempExtractPath, { recursive: true });
    }


    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipPath);
    //zip.extractAllTo(tempExtractPath, true);

    await new Promise((resolve, reject) => {
      try {
        zip.extractAllToAsync(tempExtractPath, true, (err) => {
          if (err) reject(err);
          else resolve();
        });
      } catch (error) {
        reject(error);
      }
    });


    // Extract data from XML

    const xmlPath = path.normalize(tempExtractPath + "/event.xml");
    var xmlFile
    try {
      xmlFile = await fs_promise.readFile(xmlPath, "utf8");
    }
    catch (err) {

      Log.error('\x1b[33m%s\x1b[0m', "unzip Error 2");
      res.end();
      return;
    }

    const convert = require("xml-js");
    const jsonData = JSON.parse(
      convert.xml2json(xmlFile, { compact: true, spaces: 2 })
    );

    const jsonTdpData = jsonData.TriggerDataPacket;

    const parsedPath = path.parse(zipPath);
    const folderName = parsedPath.name;  // filenameWithoutExtension

    var storedToPath;

    if (folderName.length > 60 || folderName.includes("_Q_")) {
      await findAndRenameQuipuxFiles(tempExtractPath);
    }

    if( process.env.STORE_DATA_AWS === 'true' ){

      const fullPath = await getCurrentStoragePathAWS(jsonTdpData.cameraMacAddress._text);

      storedToPath = fullPath + folderName;
      await moveFolderContentsToAWS(tempExtractPath, storedToPath);
      Log.info("Uploaded to AWS: " + fullPath);

      // Nomura - this is how we will get the full image path to retreive image using db data
      // var testAwsPath = await getPreSignedUrlOfS3File(storedToPath + imageName);

    }
    else{
      
      const fullPath = await Common.getCurrentStoragePath(jsonTdpData.cameraMacAddress._text);
      
      storedToPath = path.normalize(fullPath + folderName);
      await fse.move(tempExtractPath, storedToPath);

      Log.info("Moved to local: " + storedToPath);

      // Handle crazy Quipux formatted data
     // if (folderName.length > 60) {
     //   await findAndRenameQuipuxFiles(storedToPath);
     // }

    }

  // WebDesk AI integration
  /*
  if(jsonTdpData.cameraMacAddress._text == "f8:dc:7a:2b:a3:e1" || 
    jsonTdpData.cameraMacAddress._text == "f8:dc:7a:2b:a3:0a" || 
    jsonTdpData.cameraMacAddress._text == "f8:dc:7a:2b:a2:43"){

    validAiRecord = await saveWebdeskAiPlate(jsonTdpData, storedToPath);
    if( !validAiRecord ){
      Log.info('\x1b[33m%s\x1b[0m', "Remove Webdesk record for " + storedToPath);
      res.end();
      return;
    }

    validFinalRecord = await isValidWebdeskRecord(jsonTdpData.plateRead._text, storedToPath);

    if( !validFinalRecord ){
      Log.info('\x1b[33m%s\x1b[0m', "Filter Webdesk record for " + storedToPath);
      res.end();
      return;
    }
  }
*/

    var violationType = "Speed";
    if (jsonTdpData.violationType && jsonTdpData.violationType._text) {

      violationType = jsonTdpData.violationType._text;

      if (jsonTdpData.violationType._text === "speed") {
        violationType = "Speed";
      }
      else if (jsonTdpData.violationType._text === "Blacklist") {
        violationType = "BlackList";
      }
      else if (jsonTdpData.violationType._text === "") {
        violationType = "Speed";
      }

    }


    var vehicleClass = jsonTdpData.vehicleClass._text;

    if (!vehicleClass || !vehicleClass.trim) {
      vehicleClass = "Car";
    }

    // Artificially assign vehicle types ********************
    if (process.env.SIMULATE_VEHICLE_TYPES === 'true') {

      //	console.log("TDP Sim Vehicle:");

      const epTime = Number(jsonTdpData.timestamp._text)
      var tmpTim = Math.abs(epTime - Math.trunc(epTime / 1000) * 1000);

      if (tmpTim < 700) {
        vehicleClass = "Car";
      } else if (tmpTim < 800) {
        vehicleClass = "Moto";
      }
      else {
        vehicleClass = "Truck";
      }
    }

    // Articially Assign Violation type **********************
    if (process.env.SIMULATE_VIOLATION_TYPES === 'true') {

      //	 console.log("TDP Sim Viol:");

      if (tmpTim < 700) {
        violationType = "Speed";
      } else if (tmpTim < 800) {
        violationType = "RedLight";
      }
      else if (tmpTim < 950) {
        violationType = "BlackList";
      }
      else {
        violationType = "Helmet";
        vehicleClass = "Moto";
      }
    } // -------------------------------------------------

    // Lane number
    var laneNumb = '1';
    if ( jsonTdpData.laneAssignment._text ) {
      
      if(jsonTdpData.laneAssignment._text.length > 1){
        laneNumb = jsonTdpData.laneAssignment._text[0];
      }
      else{
        laneNumb = jsonTdpData.laneAssignment._text;
      }
    }

    // Plate vs TOF speed
    const plateSpeedNum = Number(jsonTdpData.plateSpeed_kph._text);
    const tofSpeedNum = Number(jsonTdpData.tofSpeed_kph._text);
    const vioSpeedNum = Number(jsonTdpData.violatingSpeed_kph._text);

    var speed_kph = 0.0;
    if(Math.abs(tofSpeedNum) > 0.0){
      speed_kph = tofSpeedNum;
    }
    else if(Math.abs(plateSpeedNum) > 0.0){
      speed_kph = plateSpeedNum;
    }
    else if(Math.abs(vioSpeedNum) > 0.0){
      speed_kph = vioSpeedNum;
    }

    let speedLimit = Number(jsonTdpData.currentSpeedLimit_kph._text);
    if(postedLimit > 0){
      speedLimit = postedLimit;
    }


   // const { cameraId, orgId } = await Common.getCameraAndOrgID(jsonTdpData.cameraMacAddress._text) || {};

    //var newTdpId;
      const { camID, timeZoneOffset_s } = await Common.updateCameraRecord(jsonTdpData.cameraMacAddress._text, "Unknown", jsonTdpData.latitude._text,  jsonTdpData.longitude._text);


      const timestampBI = BigInt(Number(jsonTdpData.timestamp._text)); 
      const timeZoneOffsetBI = BigInt(timeZoneOffset_s || 0); // Convert timeZoneOffset_s to BigInt, defaulting to 0 if it's falsy (null, undefined, etc.)
      const offsetEpochTime = (timestampBI / 1000n) + timeZoneOffsetBI;


      await TDP.create({
          cameraId: camID,
          storageLocation: storedToPath,
          latitude: jsonTdpData.latitude._text,
          longitude: jsonTdpData.longitude._text,
          epochTime_ms: Number(jsonTdpData.timestamp._text),
          timeZoneOffset_s: Number(jsonTdpData.timeZoneOffset_s._text),
          violationType: violationType,
          plateRead: jsonTdpData.plateRead._text,
          speed_kph: speed_kph,
          speedUncertainty_kph: Number(jsonTdpData.violatingSpeedError_kph._text),
          speedLimit_kph: speedLimit,
          gpsSpeed_kph: Number(jsonTdpData.gpsSpeed_kph._text),
          vehicleClass: vehicleClass,
          lane: laneNumb,
          trigger: jsonTdpData.triggerSource._text,
          blackListMatchPlate: jsonTdpData.blackListMatchPlate._text,
          blackListMatchDetails: jsonTdpData.blackListMatchDetails._text,
          irVideoFilename: jsonTdpData.irVideoFilename._text,
          colorVideoFilename: jsonTdpData.colorVideoFilename._text,
          offsetEpochTime_s: offsetEpochTime,

        })
        .then(async result => {
          
    //     if(orgId){  // Nov 2023 - Test for matches with previous TDPs
    //       await updateTdpMatches(orgId, result.id, jsonTdpData.plateRead._text);
    //     }

          // Add record to violation queue
          await violation_review.create({
            tdpId: result.id,
            plateRead: result.plateRead,
            createdAt: result.createdAt,
            stage: 1,
            ir_image_pan_x: 0,
            ir_image_pan_y: 0,
            ir_image_scale: 1.0,

            col_image_pan_x: 0,
            col_image_pan_y: 0,
            col_image_scale: 1.0,

          })
        });
    

    // Remove .zip file
    try {
      fs.unlinkSync(zipPath);
      //Log.debug("Delete File successfully.");
    } catch (error) {
      Log.debug("updateCameraRecord =====>", error);
    }

    Common.setCameraTimezoneOffset(jsonTdpData.cameraMacAddress._text,
      Number(jsonTdpData.timeZoneOffset_s._text));

    

    //const camID = await Common.getCameraID(jsonTdpData.cameraMacAddress._text)

    await Common.updateItemStats(camID, "TDP", vehicleClass, violationType, laneNumb,
        Number(jsonTdpData.timestamp._text));
    

   

  } catch (error) {
    Log.error(`receiveTDP: `, error);
}


  res.end();

};

function getQuipuxPostedLimit(zipPath)
{

  // "2903_f8dc7aac9b20_12345_020535_12345_010510_1_20240304_134733_0_050_073_056_050_1438__ZT_0_1000_2_4_0_77455_0_0_0_0_0_0";
  try{
    const elements = zipPath.split('_');

    if(elements.length < 17) return -1;

    const integerValue = parseInt(elements[13], 10);

    return integerValue;

  }
  catch(err){
    return -1;
  }

}



// Receive TDP Post
// eg.  http://192.7.2.158:8080/tdp
exports.receiveTDP = async (req, res) => {

 //  res.end();  // *** FOR TEST
 //  return;

  try {

    // Feb 2024 - custom Quipux TDPs send from primary (original) sending thread 
    if (req.body.protocolo !== undefined){
      await receiveQuipuxPacket(req, res);
      return;
    } 

    const startTime = timeProfiler.start();

    var mac = req.body.macAddress.trim();
    Log.info("Received TDP for: " + mac);	
    //  var unzipper = require("unzipper");  // Aug 8, 2023 - issues with unzipper
    
    const zipFile = req.files[0].buffer;

    var path = require("path");

    var tempPath = path.normalize(
      process.env.STORE_ROOT + "/temp/"
    );
    if (!fs.existsSync(tempPath)) {
      await fs_promise.mkdir(tempPath, { recursive: true });
    }


    const extension = path.extname(req.files[0].originalname).toLowerCase();

    if (extension === '.vvr') {
      Log.error("Received a ViionEncrypted Folder (.vvr).  Handling not yet implemnted" )
      res.end();
      return;
    }


    var zipPath = path.normalize(tempPath + req.files[0].originalname);
    let postedLimit = -1
    // Quipux fomatted files
    if(req.files[0].originalname.length > 60){

      postedLimit = getQuipuxPostedLimit(zipPath);
      zipPath = path.normalize(tempPath + "triggerPacket_Q_" + Date.now() + ".zip");
    }

   

    try {
      await fs_promise.writeFile(zipPath, zipFile);
      Log.debug('\x1b[33m%s\x1b[0m', "TDP written to: " + zipPath);
    } catch (err) {
      Log.error('\x1b[33m%s\x1b[0m', "writeFile" + err);
      res.end();
      return;
    }

    await processZipFile(zipPath, res, postedLimit);

    timeProfiler.end(startTime);


  } catch (err) {
    Log.error('\x1b[33m%s\x1b[0m', "writeFile" + err);
    res.end();
    return;
  }

};
  

