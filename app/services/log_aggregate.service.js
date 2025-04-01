const db = require("../models");
const CameraLog = db.camera_log;
const CameraLogAggregate = db.aggregate_camera_log;

const { Log } = require('@app/services/log.service')


function hasCrossedHourBoundary(epochTime1, epochTime2) {
    const hourUnit1 = Math.floor(epochTime1 / 3600000);
    const hourUnit2 = Math.floor(epochTime2 / 3600000);
    
    return hourUnit1 !== hourUnit2;
}

const createLogAggregate = async () => {

    Log.debug("***** Create Aggregate Logs - other functionality disabled");

    try {
        const camLogs = await CameraLog.findAll({ order: ['epochTime_ms'] }); // Assuming the logs are sorted by time for efficient processing

        const cameraMap = {};
        for (let logRec of camLogs) {

            if (!cameraMap[logRec.cameraId]) {
                cameraMap[logRec.cameraId] = {
                    lastEpochTime: logRec.epochTime_ms,
                };
                continue;
            }

            // Save values 1/hour
            if (hasCrossedHourBoundary(cameraMap[logRec.cameraId].lastEpochTime, logRec.epochTime_ms)) {
                
                // This copies the id from CameraLog - prevents adding duplicate records
              //  await CameraLogAggregate.create({ ...logRec.dataValues });
              //  cameraMap[logRec.cameraId].lastEpochTime = logRec.epochTime_ms;

                
                // This removes the id from CameraLog data before saving
                const { id, ...dataWithoutId } = logRec.dataValues;
                await CameraLogAggregate.create(dataWithoutId);
                cameraMap[logRec.cameraId].lastEpochTime = logRec.epochTime_ms;
            }
        }

    } catch (error) {
        Log.error("Error during Table Management:", error);
    } finally {
        Log.info('createLogAggregate - Completed');
    }
}


module.exports = createLogAggregate;