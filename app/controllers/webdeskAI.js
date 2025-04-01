const { Log } = require('@app/services/log.service')
const TimeProfiler = require('./time_profiler.js');
const path = require('path');
const sizeOfImage = require('image-size');


const timeProfilerAI = new TimeProfiler('\x1b[32m%s\x1b[0m', "Avg Proc AI Time: ", 10, "AI_ProcTime_ms");

async function extractReadAI(directory) {
  

    const image_path = path.join(directory, 'centered_416.png');
 
    if (!fs.existsSync(image_path)) return;
  
    try {
        const yoloPythonSourcePath = process.env.YOLO_OCR_SRC_PATH;
        const paramsPath = process.env.YOLO_OCR_PARAMS_PATH;
  
        const pythonProcess = spawn('python3', [yoloPythonSourcePath, paramsPath, image_path]);
        const promiseForData = new Promise((resolve, reject) => {
  
         let accumulatedData = '';
 
         pythonProcess.stdout.on('data', (data) => {
 
           accumulatedData += data.toString();
         });
 
         pythonProcess.on('close', (code) => {
 
           // Resolve the promise when the Python script has finished executing
           if (code === 0) {
               resolve(accumulatedData);
           } else {
               reject(new Error(`Python script exited with code ${code}`));
           }
         });
 
         pythonProcess.stderr.on('data', (data) => {
             const errorMessage = data.toString();
             reject(new Error(errorMessage));
         });  
 
        });
  
        const result = await promiseForData;
        return result;
 
    } catch (error) {
        Log.error("Error during yolo OCR:", error.message);
        return null;
    }
  }
 
 async function extractPlateAI(directory, leftPlate, topPlate, widthPlate, heightPlate) {
   
 
  // const image_path = `${directory}\\irFrame.jpg`;
   const image_path = path.join(directory, 'irFrame.jpg');
 
   try {
       const yoloPythonSourcePath = process.env.YOLO_PLATE_SRC_PATH;
       const paramsPath = process.env.YOLO_PLATE_PARAMS_PATH;
 
       const pythonProcess = spawn('python3', [yoloPythonSourcePath, paramsPath, image_path, leftPlate, topPlate, widthPlate, heightPlate]);
       const promiseForData = new Promise((resolve, reject) => {
 
         let accumulatedData = '';
 
         pythonProcess.stdout.on('data', (data) => {
 
           accumulatedData += data.toString();
         });
 
         pythonProcess.on('close', (code) => {
 
           // Resolve the promise when the Python script has finished executing
           if (code === 0) {
               resolve(accumulatedData);
           } else {
               reject(new Error(`Python script exited with code ${code}`));
           }
         });
 
         pythonProcess.stderr.on('data', (data) => {
             const errorMessage = data.toString();
             reject(new Error(errorMessage));
         });          
 
       });
 
       const result = await promiseForData;
       return result;
 
   } catch (error) {
       Log.error("Error during yolo Plate:", error.message);
       return null;
   }
 }
 
 async function isValidWebdeskRecord(plateRead, uncompressedPath)
 {
 
   try {
 
     if (plateRead == null) {
       return false;
     }
     
     if(plateRead.length < 6){
       return false;
     }
 
     const imagePath = path.normalize(uncompressedPath + "/plate.png");
   
 
     // Plate image dimensions are not reasonable
     try {
         const dimensions = sizeOfImage(imagePath);
         //console.log(dimensions); // { width: x, height: y, type: 'jpg' }
 
         let dimRatio = dimensions.width / dimensions.height;
 
         if(dimRatio < 1.2){
           return false;
         }
 
     } catch (error) {
         Log.error('isValidWebdeskRecord get size:', error);
     }
     
     return true;
 
   } catch (error) {
       Log.error('isValidWebdeskRecord:', error);
       return false;
   }
 
 }
 
 function parseAndLogMessages(accumulatedMsg) {
   if (accumulatedMsg == null || accumulatedMsg.length < 3) return;
 
   // Normalize line endings to Unix-style (Linux and MacOS)
   let normalizedMsg = accumulatedMsg.replace(/\r\n/g, "\n");
 
   // Split the normalized message by line breaks
   const messages = normalizedMsg.split('\n');
   let jsonData = null;
 
   messages.forEach(msg => {
       if (msg.trim()) { // Check if the message is not just empty spaces
           try {
               // Try to parse the message as JSON
               jsonData = JSON.parse(msg);
               Log.info("JSON data detected:", jsonData);
           } catch (e) {
               // If it's not JSON, just log it as a regular message
               //Log.info("Message:", msg);
           }
       }
   });
 
   return jsonData;
 }
 
 
 function processOCR_AI(jsonTdpData, accumulatedOcrMsg) {
 
   if (!accumulatedOcrMsg) return;
 
   const aiReadJson = parseAndLogMessages(accumulatedOcrMsg);
   if (!aiReadJson || !aiReadJson.orderedCharacters) return;
 
   //Log.info("MK est 1: " + JSON.stringify(aiReadJson));
 
   const aiRead = aiReadJson.orderedCharacters.replace(/\n/g, '');
   const cameraRead = jsonTdpData.plateRead._text;
 
   //Log.info("MK est: " + cameraRead + " and " + aiRead);
 
   let wasReplaced = false;
   if (aiRead.length === 9 || aiRead.length === 8) {
       if (aiRead.startsWith("HB") || aiRead.startsWith("H8") || aiRead.startsWith("W8") || aiRead.startsWith("NB") || aiRead.startsWith("N8")) {
           jsonTdpData.plateRead._text = "WB" + aiRead.slice(2);
           wasReplaced = true;
       } else if (aiRead.startsWith("WB")) {
           jsonTdpData.plateRead._text = aiRead;
           wasReplaced = true;
       }
   }
 
   if (wasReplaced) {
       Log.info(`\x1b[33mprocessOCR_AI replaced ${cameraRead} with ${jsonTdpData.plateRead._text}\x1b[0m`);
   }
 }
 
 
 // AI Plate find + Read
 async function saveWebdeskAiPlate(jsonTdpData, uncompressedPath)
 {
   try {
 
     const startTimeAI = timeProfilerAI.start();
 
     const imagePath = path.normalize(uncompressedPath + "/plate.png");
 
     // Plate image is bigger than expected - bypass record
     try {
         const dimensions = sizeOfImage(imagePath);
         //console.log(dimensions); // { width: x, height: y, type: 'jpg' }
 
         if(dimensions.width > 800){
           return false;
         }
 
     } catch (error) {
         Log.error('Error getting image size:', error);
     }
     
 
     // Assuming each FrameData may contain multiple PlateData entries
     let frameDatas = jsonTdpData.irFrames.FrameData || [];
 
     // Ensure frameDatas is always an array
     if (!Array.isArray(frameDatas)) {
         frameDatas = [frameDatas]; // Convert to array if it's a single object
     }
 
 
     if (frameDatas.length > 0) {
         let plates = frameDatas[0].plates;
         if (plates) {
 
             // Ensure plates is always an array
             if (!Array.isArray(plates)) {
                 plates = [plates]; // Convert to array if it's a single object
             }
 
             if (plates.length > 0 && plates[0].PlateData) {
                 let plateData = plates[0].PlateData;
                 if (Array.isArray(plateData)) {
                     plateData = plateData[0];
                 }
                 
                 if (plateData.left && plateData.left._text) {
 
                   const leftPlate = plateData.left._text;
                   const topPlate = plateData.top._text;
                   const widthPlate = plateData.width._text;
                   const heightPlate = plateData.height._text;
                   
                   // Plate finder
                   let accumulatedPlateMsg = await extractPlateAI(uncompressedPath, leftPlate, topPlate, widthPlate, heightPlate);
                   if (accumulatedPlateMsg !== null) {
                     parseAndLogMessages(accumulatedPlateMsg);
                   }
 
                   // OCR
                   // camera read < 8 chars
                   try{
                     if (jsonTdpData && jsonTdpData.plateRead && jsonTdpData.plateRead._text !== undefined && jsonTdpData.plateRead._text.length < 8) {
 
                       let accumulatedOcrMsg = await extractReadAI(uncompressedPath);
                       processOCR_AI(jsonTdpData, accumulatedOcrMsg)
 
                     }
                   } catch (error) {
                       Log.error(`Error : ${error.message}`);
                   }
 
                   timeProfilerAI.end(startTimeAI);
 
                 }
             }
         }
     }
 
     return true;
 
   } catch (error) {
       Log.error('Error accessing plate values:', error);
   }
 }

 module.exports = {
    saveWebdeskAiPlate,
    isValidWebdeskRecord
}