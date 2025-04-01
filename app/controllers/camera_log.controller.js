const db = require("../models");
const CameraLog = db.camera_log;
const CameraLogRaw = db.raw_camera_log;
const Camera = db.camera;
const CameraLogAggregate = db.aggregate_camera_log;

const { Log } = require('@app/services/log.service')
var Common = require("./common.controller.js");

const builder = require('xmlbuilder');

const util = require('util');
const parseStringPromise = util.promisify(require('xml2js').parseString);


const TimeProfiler = require('./time_profiler.js');
const timeProfilerLog = new TimeProfiler('\x1b[32m%s\x1b[0m', "Avg Receive Log Time: ", 50, "Log_ReceiveTime_ms");
const timeProfilerSetng = new TimeProfiler('\x1b[32m%s\x1b[0m', "Avg Receive Settings Time: ", 50, "Settings_ReceiveTime_ms");


function hasCrossedHourBoundary(epochTime1, epochTime2) {
  const hourUnit1 = Math.floor(epochTime1 / 3600000);
  const hourUnit2 = Math.floor(epochTime2 / 3600000);
  
  //Log.debug("V1 " + hourUnit1 + " V2 " + hourUnit2);

  return hourUnit1 !== hourUnit2;
}

function seemsUrlEncoded(str) {
  // Regular expression to look for percent-encoded characters
  const urlEncodedPattern = /%[0-9A-Fa-f]{2}/;

  return urlEncodedPattern.test(str);
}

// Settings and commands
// Settings = use 1/0 for true/false - multiple settings pipe | delimited 
// SpeedEventSettings::overlayEnabled=1|SpeedEventSettings::showTimeCode=1
async function sendMessagesBackToCamera(macAddress, res) {
  
  let xmlResponse = '';

  try {
    const camera = await Camera.findOne({
      where: {
        macAddress: macAddress
      }
    });

    if (!camera) {
      return false; 
    }

    let doSend = false;
    xmlResponse += '<?xml version="1.0" encoding="UTF-8"?>\n';
    xmlResponse += "<camera>\n";

    // Handling sendCommand
    if (camera.sendCommand && camera.sendCommand.length > 1) {
      doSend = true;
      xmlResponse += `\t<execute>\n\t\t<system>\n\t\t\t${camera.sendCommand}\n\t\t</system>\n\t</execute>\n`;
      // Reset sendCommand in the database
      await camera.update({ sendCommand: '' });
    }

    // Handling sendSetting
    if (camera.sendSetting && camera.sendSetting.length > 1) {
      doSend = true;
      const lines = camera.sendSetting.split("|");

      xmlResponse += "\t<settings>\n";

      lines.forEach(line => {
        const [className, rest] = line.split("::");
        if (rest) {
          const [fieldName, value] = rest.split("=");
          if (fieldName && value) {
            xmlResponse += `\t\t<${className.trim()}>\n`;
            xmlResponse += `\t\t\t<${fieldName.trim()}>${value.trim()}</${fieldName.trim()}>\n`;
            xmlResponse += `\t\t</${className.trim()}>\n`;
          }
        }
      });

      xmlResponse += "\t</settings>\n";
      // Reset sendSetting in the database
      await camera.update({ sendSetting: '' });
    }

    xmlResponse += "</camera>\n";

    if (doSend) {
      res.setHeader('Content-Type', 'application/xml');
      res.send(xmlResponse);
      return true; // Successfully sent messages back to the camera
    }
    
  } catch (error) {
    console.error("Error in sendMessagesBackToCamera:", error);
    // Handle any errors that occurred during processing
  }

  return false; 
}





exports.diagLog = async (req, res) => {
 
 
 const startTime = timeProfilerLog.start();

 var macAddress = '';
 
  try {
      const result = await parseStringPromise(req.body.diagnostics);

      var diagNode = result.DiagnosticSummary;
  
      macAddress = diagNode.macAddress[0]['_'];
      var cameraType = diagNode.cameraType[0]['_'];
      var epochTime_ms = parseInt(diagNode.epochTime_ms[0]['_']);
     
      var cpuTempStr = diagNode.CPU_temp_C[0]['_'];
      var cpuTemp = cpuTempStr.replace(",",".").replace(/[^0-9&.]/g,'');

      var voltageSrc = parseFloat(diagNode.batteryVoltage_V[0]['_']);
      var voltage3_3 = parseFloat(diagNode.Power_3_3_V[0]['_']);
      var voltage5_0 = parseFloat(diagNode.Power_5_V[0]['_']);

      var aiRate = 0;
      if(diagNode.aiRate_FPS){  // this may not be present
        aiRate = (diagNode.aiRate_FPS[0]['_']);
      }

      var aiTemp1 = 0;
      var aiTemp2 = 0;
      if(diagNode.aiModTemps_c && diagNode.aiModTemps_c[0]['_'] ){
        
        let tempStr = diagNode.aiModTemps_c[0]['_'];
        let floats = tempStr.split(/\s+/); // Split the string by one or more whitespace characters

        // Parse the floats as integers
        aiTemp1 = parseInt(floats[0], 10); 
        aiTemp2 = parseInt(floats[1], 10); 

      }

      var vioPerHour = "0";
      if(diagNode.violationsPerHr && diagNode.violationsPerHr[0]['_']){
        vioPerHour = diagNode.violationsPerHr[0]['_'];
      }
      if(diagNode.violationsPerHour && diagNode.violationsPerHour[0]['_']){
        vioPerHour = diagNode.violationsPerHour[0]['_'];
      }

      var vehPerHour = "0";
      if(diagNode.vehiclesPerHr && diagNode.vehiclesPerHr[0]['_']){
        vehPerHour = diagNode.vehiclesPerHr[0]['_'];
      }
      if(diagNode.vehiclesPerHour && diagNode.vehiclesPerHour[0]['_']){
        vehPerHour = diagNode.vehiclesPerHour[0]['_'];
      }

  
      let myDate = new Date(epochTime_ms);
      let dateStr = myDate.getFullYear() + "-" + (myDate.getMonth() + 1) + "-" + myDate.getDate() + 
        " " + myDate.getHours() + ":" +  ('0' + myDate.getMinutes()).slice(-2) +
         ":" +  ('0' + myDate.getSeconds()).slice(-2);
  

      Log.debug('\x1b[33m%s\x1b[0m', 'Update diagnostic_log: ' + dateStr);

      var latitude = parseFloat(diagNode.latitude[0]['_']);
      var longitude = parseFloat(diagNode.longitude[0]['_'])

      // Oct 2023 new values

      var uploadedThisMonth_MB = 0;
      if(diagNode.uploadedThisMonth_MB && diagNode.uploadedThisMonth_MB[0]['_']){
        uploadedThisMonth_MB = parseInt(diagNode.uploadedThisMonth_MB[0]['_']);
      }

      var downloadedThisMonth_MB = 0;
      if(diagNode.downloadedThisMonth_MB && diagNode.downloadedThisMonth_MB[0]['_']){
        downloadedThisMonth_MB = parseInt(diagNode.downloadedThisMonth_MB[0]['_']);
      }

      var completeTdpSent = 0;
      if(diagNode.completeTdpUploads && diagNode.completeTdpUploads[0]['_']){
        completeTdpSent = parseInt(diagNode.completeTdpUploads[0]['_']);
      }

      var lostTdpSent = 0;
      if(diagNode.lostTdpUploads && diagNode.lostTdpUploads[0]['_']){
        lostTdpSent = parseInt(diagNode.lostTdpUploads[0]['_']);
      }

      var completeMesgSent = 0;
      if(diagNode.completeMesgUploads && diagNode.completeMesgUploads[0]['_']){
        completeMesgSent = parseInt(diagNode.completeMesgUploads[0]['_']);
      }

      var lostMesgSent = 0;
      if(diagNode.lostMesgUploads && diagNode.lostMesgUploads[0]['_']){
        lostMesgSent = parseInt(diagNode.lostMesgUploads[0]['_']);
      }

      var tofAvgEstErr = 0.0;  // not sent.  Updated app Oct 31, 2023
      if(diagNode.tofAvgEstimateError && diagNode.tofAvgEstimateError[0]['_']){
        tofAvgEstErr = parseFloat(diagNode.tofAvgEstimateError[0]['_']);
      }

      var avgTdpXferSec = 0.0;
      if(diagNode.avgTdpXferSec && diagNode.avgTdpXferSec[0]['_']){
        avgTdpXferSec = parseFloat(diagNode.avgTdpXferSec[0]['_']);
      }

      var maxTdpXferSec = 0.0;
      if(diagNode.maxTdpXferSec && diagNode.maxTdpXferSec[0]['_']){
        maxTdpXferSec = parseFloat(diagNode.maxTdpXferSec[0]['_']);
      }

      var avgPlateXferSec = 0.0;
      if(diagNode.avgPlateXferSec && diagNode.avgPlateXferSec[0]['_']){
        avgPlateXferSec = parseFloat(diagNode.avgPlateXferSec[0]['_']);
      }

      var maxPlateXferSec = 0.0;
      if(diagNode.maxPlateXferSec && diagNode.maxPlateXferSec[0]['_']){
        maxPlateXferSec = parseFloat(diagNode.maxPlateXferSec[0]['_']);
      }

      const { camID, timeZoneOffset_s } = await Common.updateCameraRecord(macAddress, cameraType, latitude, longitude);
      
      // Removed Feb 24, 2024
      //CameraLogRaw.create({
      //  cameraId: camID,
      //  log: req.body.diagnostics
      //});
    
      const prevLog = await CameraLog.findOne({
        where: {
            cameraId: camID
        },
        order: [
            ['id', 'DESC']
        ]
      });


      try {
        const createdCameraLog = await CameraLog.create({
            
            macAddress: macAddress,
            ipAddress: diagNode.ipAddress[0]['_'],
            latitude: latitude,
            longitude: longitude,
            speedThresh: parseInt(diagNode.speedThresh[0]['_']),
            timeZoneOffset_s: timeZoneOffset_s,
            epochTime_ms: epochTime_ms,
            uptime: diagNode.uptime[0]['_'],
            VPNAddress: diagNode.VPNAddress[0]['_'],
    
            IR: parseInt(diagNode.IRCameraCaptureRate_FPS[0]['_']),
            Col: parseInt(diagNode.colorCameraCaptureRate_FPS[0]['_']),
            TOF: parseInt(diagNode.tofCameraCaptureRate_FPS[0]['_']),
    
            Proc: parseInt(diagNode.processingRate_FPS[0]['_']),
            AI: aiRate,
            captLossPerc: parseInt(diagNode.captureLossPercnt[0]['_']),
            cpuTemp: cpuTemp,
            tofSensTemp: parseInt(diagNode.tofSensorTemp_c[0]['_']),
            
            fpgaTemp: parseInt(diagNode.FPGATemp_C[0]['_']),
            aiTemp1: aiTemp1,
            aiTemp2: aiTemp2,
      
            VehiclesPerHour: parseInt(vehPerHour),
            ViolationsPerHour: parseInt(vioPerHour),
  
            voltageSrc: voltageSrc,
            voltage3_3: voltage3_3,
            voltage5_0: voltage5_0,
            
            cameraId: camID,
  
            // Oct 2023
            uploadedThisMonth_MB: uploadedThisMonth_MB,
            downloadedThisMonth_MB: downloadedThisMonth_MB,
            completeTdpSent: completeTdpSent,
            lostTdpSent: lostTdpSent,
            completeMesgSent: completeMesgSent,
            lostMesgSent: lostMesgSent,
            tofAvgEstErr: tofAvgEstErr,
            avgTdpXferSec: avgTdpXferSec,
            maxTdpXferSec: maxTdpXferSec,
            avgPlateXferSec: avgPlateXferSec,
            maxPlateXferSec: maxPlateXferSec


        });
    
        // Aggregate logs
        if( prevLog && createdCameraLog && 
          hasCrossedHourBoundary(prevLog.epochTime_ms, createdCameraLog.epochTime_ms)){
  
          Log.info("Creating Aggregate Log record for cam " + camID);
          const { id, ...dataWithoutId } = createdCameraLog.dataValues;
          await CameraLogAggregate.create(dataWithoutId);
  
        }

      } catch(err) {
          Log.error('\x1b[33m%s\x1b[0m', "cameraLog " + err);
      }

      await Common.setCameraTimezoneOffset(macAddress, Number(diagNode.timeZoneOffset_s[0]['_']));

      var epoch = Number(diagNode.epochTime_ms[0]['_']);

      //Common.getCameraID(macAddress, function (camID) {

      await Common.updateItemStats(camID, "Log", "", "", "", Number(epoch));

      //});

	timeProfilerLog.end(startTime);
     
      
  } catch (err) {
      Log.debug("cameraLogController Diagnostics Error: ", err);
      Log.debug(req.body.diagnostics);  
      res.end();
  }

  if(req.body.settings){

	const startTime2 = timeProfilerSetng.start();

    var macAddress2 = req.body.name;

    try {

      let rawXmlInput = req.body.settings;
      var settingsXml;

      // Jan 3, 2024 - Whitespace error - sometime settings are URL encoded (unit a3:a9) 
      if (seemsUrlEncoded(rawXmlInput)) {
        try {
          settingsXml = decodeURIComponent(rawXmlInput);  
        } catch (error) {
          // URI may be malformed - possibly too long
            Log.debug("cameraLogController Error Decoding:", error.message);
            Log.debug("For Unit:  " + macAddress);
       //     Log.debug(req.body.settings);  
            res.end();
            return;
        }
      } else {
        settingsXml = rawXmlInput;
      }

      const parseResult = await parseStringPromise(settingsXml);

      var settingsNode = parseResult.AllSettings;

      // All setting saved as a JSON string
      let jsonString = JSON.stringify(settingsNode);
            
      await Common.updateCameraSettings(macAddress2, jsonString);
	  
	    timeProfilerSetng.end(startTime2);

    } catch (err) {
      Log.debug("cameraLogController Settings Error: ", err);
      Log.debug("For Unit:  " + macAddress);
   //   Log.debug(req.body.settings);  // Jan 3, 2024 - Whitespace error
      res.end();
    }

  }

  // Mar 2024 - return settings/commands
  try {
    if( await sendMessagesBackToCamera(macAddress, res) ) return;
  } catch (err) {
    Log.debug("sendMessagesBackToCamera Error: ", err);
  }

  res.end();
 
};




