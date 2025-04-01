const db = require("../models");
const fs = require("fs");
const fs_promise = require('fs').promises

const Plate = db.plate;
//const ReceivedItem = db.received_item;
//const ReceivedItemStats = db.received_item_stat;
var Common = require("./common.controller.js");
const { Log } = require('@app/services/log.service')
const { uploadFileStreamToS3 } = require("@app/services/aws.service");
const { VEHICLE_CLASSES } = require("@app/config/app.config")


const TimeProfiler = require('./time_profiler.js');
const timeProfiler = new TimeProfiler('\x1b[32m%s\x1b[0m', "Avg Receive Plate Time: ", 50, "Plate_ReceiveTime_ms");


//const useAWS_Storage = true;

async function writeImageFile(correctPath, req, tag)
{
 if(!req.files) return "";

  for (let i = 0; i < req.files.length; i++) {

    if(req.files[i].originalname.includes(tag)){

      var outFilePath = correctPath + req.files[i].originalname;

      try {
        await fs_promise.writeFile(outFilePath, req.files[i].buffer);  
        //Log.debug('\x1b[33m%s\x1b[0m', "Plate file written successfully: " + req.files[i].originalname);
        //console.log('\x1b[33m%s\x1b[0m', "Plate file written successfully: " + req.files[i].originalname);
      } catch(err) {
        Log.error('\x1b[33m%s\x1b[0m', "writeFileSync" + err);
        return;
      }
      return outFilePath;
    }
  }
  return "";
}

async function writeImageFileAWS(bucketPath, req, tag)
{
 if(!req.files) return "";

  for (let i = 0; i < req.files.length; i++) {

    if(req.files[i].originalname.includes(tag)){

      var outFilePath = bucketPath + req.files[i].originalname;

      try {

        await uploadFileStreamToS3(req.files[i].buffer, outFilePath)
        //var file_url_for_frontend1 = await getPreSignedUrlOfS3File(outFilePath)  // this is too complicated to store in db 

        //const bucketBaseURL = 'https://cortex-server.s3.us-west-2.amazonaws.com/';
        //const bucketPath = 'f8dc7a9c407f/2024-02-13/H11/';
        //const filename = 'imgPlt1707851300887.png';
        
        return req.files[i].originalname;

      } catch(err) {
        Log.error('\x1b[33m%s\x1b[0m', "writeImageFileAWS" + err);
        return "";
      }
      
    }
  }
  return "";
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

function getMonthNumberSinceEpoch(epochTimeInSeconds) {
  // Convert epoch time in seconds to milliseconds
  const inputDate = new Date(epochTimeInSeconds * 1000);

  // Unix epoch date (January 1, 1970)
  const epoch = new Date(1970, 0, 1);

  // Calculate the number of months since the Unix epoch
  const monthsSinceEpoch = (inputDate.getFullYear() - epoch.getFullYear()) * 12 + (inputDate.getMonth() - epoch.getMonth());

  return monthsSinceEpoch;
}



// Receive Plate Record Post
exports.receivePlate = async (req, res) => {

  //res.end();  // *** FOR TEST
  //return;


  const startTime = timeProfiler.start();


  var mac = req.body.macAddress.trim();

  if(!Common.isValidMac(mac)){
    Log.debug("Invalid mac: " + mac);
    res.end();
    return;
  }
 
  var plateRead = req.body.plateRead.trim();

  var fullPath;
  var plateImagePath;
  var irImagePath;
  var colImagePath;


  if( process.env.STORE_DATA_AWS === 'true' ){

     fullPath = await getCurrentStoragePathAWS(mac);  // == bucketPath with AWS

     plateImagePath = await writeImageFileAWS(fullPath, req, "Plt");
     irImagePath = await writeImageFileAWS(fullPath, req, "IR");
     colImagePath = await writeImageFileAWS(fullPath, req, "Col");
    
  }
  else{

     fullPath = await Common.getCurrentStoragePath(mac);
     plateImagePath = await writeImageFile(fullPath, req, "Plt");
     irImagePath = await writeImageFile(fullPath, req, "IR");
     colImagePath = await writeImageFile(fullPath, req, "Col");
  }
  
  var vehClass = "Car";
  if ((req.body.vehicleClass !== undefined)  && (req.body.vehicleClass.trim() !== "" ) ){

    vehClass = req.body.vehicleClass;
  }

  // Temporary artificial vehicle assignments **************************
  if( process.env.SIMULATE_VEHICLE_TYPES === 'true'){
    
	//console.log("Plate VEHICLE SIMULATE");
	
    var tmpTim = Math.abs(req.body.timestamp - Math.trunc(req.body.timestamp  / 1000) * 1000);

    if(tmpTim < 700){
      vehClass = "Car";
    }else if(tmpTim < 800){
      vehClass = "Moto";
    }
    else{
      vehClass = "Truck";
    }
  }

  var laneNumb = '1';  


  if ((req.body.laneID !== undefined)  && (req.body.laneID.trim() !== "" ) ){

    // lane-change - select starting lane
    if(req.body.laneID.length > 1){
      laneNumb = req.body.laneID[0];
    }else{
      laneNumb = req.body.laneID;
    }
  }


//*************************************************** */

  var speed_kph =  req.body.estSpeedKph;
  var uncertainty_kph = req.body.estSpeedConfidenceKph;

  if(uncertainty_kph > 15.0){
    speed_kph = 0.0;
    uncertainty_kph = 0.0;
  }

  
  var path = require("path");

  const { camID, timeZoneOffset_s } = await Common.updateCameraRecord(mac, "Unknown", req.body.latitude, req.body.longitude);
  //Common.updateCameraRecord(mac, "Unknown", req.body.latitude, req.body.longitude, function(camID, timeZoneOffset_s){

  

  const timestamp_s = Number(BigInt(req.body.timestamp) / 1000n);  
  const timeZoneOffset = Number(timeZoneOffset_s || 0); // defaulting to 0 if it's falsy (null, undefined, etc.)
  const offsetEpochTime_s = timestamp_s + timeZoneOffset;

  const indxVehicleClass = VEHICLE_CLASSES.indexOf(vehClass);

  if(indxVehicleClass < 0) indxVehicleClass = 1; // car default

  const monthEpoch = getMonthNumberSinceEpoch(timestamp_s);

  try {
    const createdRecord = await Plate.create({
      cameraId: camID,
      storageLocation: fullPath,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      timeZoneOffset_s: timeZoneOffset_s,
      epochTime_ms: req.body.timestamp,
      plateRead: plateRead,
      speed_kph: speed_kph,
      speedUncertainty_kph: uncertainty_kph,
      plateImageFilename: path.basename(plateImagePath),
      irImageFilename: path.basename(irImagePath),
      colImageFilename: path.basename(colImagePath),
   //   vehicleClass: vehClass,
      vehicleClassId: indxVehicleClass,
      laneId: laneNumb,
      offsetEpochTime_s: offsetEpochTime_s
    });
  
    //console.log('Record created:', createdRecord);
  } catch (error) {
    Log.error('Error creating plate record:', error);
  }




    if (Math.abs(speed_kph) > 0.5){  // only compile stats for non-zero speeds
    
      await Common.updateItemStats(camID, "Plate", vehClass, "", laneNumb, Number(req.body.timestamp));
      await Common.updatePlateSpeedStats(camID, speed_kph, vehClass, laneNumb, Number(req.body.timestamp));
    }

    timeProfiler.end(startTime);

   // Common.getVehicleClassID(vehClass, function(vehClassID){

//      updatePlateStats(camID, vehClassID, Number(req.body.timestamp));
    
   // })

  

  //res.send("OK");
 res.end();

};

