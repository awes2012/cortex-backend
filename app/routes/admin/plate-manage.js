const { verifySignUp } = require("@app/middleware");
const multer = require("multer");

const base_url = '/api/admin/plates'
const db = require("@app/models");
const Op = db.Sequelize.Op
const ResCode = require('@app/routes/res_code')
const fs = require("fs");
const { QueryTypes } = require("sequelize");
var Common = require("@app/controllers/common.controller.js");
const { readFileData } = require("@app/services/file.service");
const { Log } = require('@app/services/log.service')
const { faker } = require('@faker-js/faker');
const moment = require('moment')
var path = require("path");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const res_code = require("@app/routes/res_code");
const { getFileUrlForClient } = require("@app/services/appstorage.service");
const { VEHICLE_CLASSES } = require("@app/config/app.config")


 function getVehicleClassCondition(selectedVehicleTypes)
{

   // Map selected vehicle types to their indices
    const vehicleClassIndexMap = VEHICLE_CLASSES.reduce((acc, vehicleClass, index) => {
        acc[vehicleClass] = index;
        return acc;
    }, {});

    const selectedVehicleIndices = selectedVehicleTypes
    .map(vehicleClass => vehicleClassIndexMap[vehicleClass])
    .filter(index => index !== undefined); // Filter out any undefined indices

    // Construct the SQL condition using the indices
    let vehicleCond = selectedVehicleIndices.length > 0 
    ? ` and p.vehicleClassId IN (${selectedVehicleIndices.join(',')})` 
    : ' ';

    return vehicleCond;

}

module.exports = function (app) {

    app.post(base_url + "/search", async (req, res) => {

        Log.info('\x1b[35m%s\x1b[0m', "Begin admin plates search");

        try {
            let { paginationParams,
                status,
                selectedCameraIds,
                selectedVehicleTypes,
                selectedViolationTypes,
                startDate, endDate,
                startSpeed, endSpeed } = req.body

            let order = ['p.offsetEpochTime_s ', 'DESC']
            let sortModel = paginationParams.sortModel

            // MK - to review.  If we are searching for a plate, then we don't want to limit using pagination
            // thus far there is no search capability here
            let limit = paginationParams.pageSize  
            let page = paginationParams.page

            if (sortModel) {
                if (sortModel.field == 'epochTime_ms') {
                    order = ['p.offsetEpochTime_s', sortModel.sort]
                } else {
                    order = [sortModel.field, sortModel.sort]
                }
            }
            // MK Feb 2024 - a new field added (offsetEpochTime_s)that provides offset epochTime in sec 
            //    let dateField = `DATE_FORMAT(FROM_UNIXTIME( p.timeZoneOffset_s + p.epochTime_ms / 1000), '%Y-%m-%d %H:%i:%s')`
            let speedFilterCond = ''


            let isoStartDate = startDate.replace(' ', 'T') + 'Z';
            let startDateObj = new Date(isoStartDate);
            let epochTimeStart_s = Math.floor(startDateObj.getTime() / 1000);

            let isoEndDate = endDate.replace(' ', 'T') + 'Z';
            let endDateObj = new Date(isoEndDate);
            let epochTimeEnd_s = Math.floor(endDateObj.getTime() / 1000);


            //let startDateCond = startDate ? ` and (${dateField}) >= '${startDate}'` : ' '
            //let endDateCond = endDate ? ` and (${dateField}) <= '${endDate}'` : ' '
            let startDateCond = ` AND offsetEpochTime_s >= ${epochTimeStart_s}`;
            let endDateCond = ` AND offsetEpochTime_s <= ${epochTimeEnd_s}`;


            let cameraIdsCond = selectedCameraIds.length > 0 ? ` and p.cameraId IN (${selectedCameraIds.join(',')})` : ' '
            //let vehicleCond = selectedVehicleTypes.length > 0 ? ` and p.vehicleClass IN (${selectedVehicleTypes.map(i => '"' + i + '"').join(',')})` : ' '
             // June 2024 - Map selected vehicle types to their indices
            let vehicleCond = getVehicleClassCondition(selectedVehicleTypes);

            
            if (startSpeed != endSpeed) {
                speedFilterCond = ` and (p.speed_kph IS NULL OR (p.speed_kph >= ${startSpeed} and p.speed_kph <= ${endSpeed})) `
            }
            let where_cond = `
                WHERE 1 ${cameraIdsCond}
                ${startDateCond} ${endDateCond} ${speedFilterCond}  ${vehicleCond}
            `

            // June 2024 - Join not required
            //let sql = `SELECT count(*) as total_count
            //    FROM plates p LEFT JOIN cameras c on p.cameraId = c.id
            //    ${where_cond}
            //    `

            let sql = `SELECT count(*) as total_count
                FROM plates p
                ${where_cond}
                `

            //Log.info('\x1b[35m%s\x1b[0m', "sql: " + sql);


            let total_count = await db.sequelize.query(sql,
                { type: QueryTypes.SELECT });


            Log.info('\x1b[35m%s\x1b[0m', "Admin Plates Search 1");


            total_count = total_count[0] ? total_count[0].total_count : 0
            sql = `SELECT 
            p.id as id, p.plateRead, p.cameraId, p.storageLocation, p.vehicleClassId, p.speed_kph, p.plateImageFilename, p.epochTime_ms, p.timeZoneOffset_s,
            c.name as camera_name
            FROM 
                plates p LEFT JOIN cameras c on p.cameraId = c.id
                ${where_cond}
                ORDER BY ${order.join(' ')}
                LIMIT ${limit} OFFSET ${page * limit} 
            `
            //  LIMIT ${limit} OFFSET ${page * limit} 

            const plates = await db.sequelize.query(
                sql,
                { type: QueryTypes.SELECT });

            Log.info('\x1b[35m%s\x1b[0m', "Admin Plates Search 2");



            for (let index = 0; index < plates.length; index++) {
                const plate = plates[index];
                const platePath = plate.storageLocation + "/" + plate.plateImageFilename;
                plate['plateImageUrl'] = plate.plateImageFilename ? await getFileUrlForClient(platePath) : null
                // June 2024 - assign a vehicleClass label
                if (plate.vehicleClassId >= 0 && plate.vehicleClassId < VEHICLE_CLASSES.length) {
                    plate['vehicleClass'] = VEHICLE_CLASSES[plate.vehicleClassId];
                  } 
            }

            Log.info('\x1b[35m%s\x1b[0m', "End Admin Plates Search");


            res.send({ error: false, data: plates, total_count });
        } catch (error) {
            console.info(error)
            res.status(500).send({ success: false, error: error });
        }
    })


    app.post(base_url + "/download_csv", async (req, res) => {
        try {

            Log.info('\x1b[32m%s\x1b[0m', "Begin generate CSV");

            let { paginationParams,
                status,
                selectedCameraIds,
                selectedVehicleTypes,
                selectedViolationTypes,
                startDate, endDate,
                startSpeed, endSpeed } = req.body

            let order = ['p.epochTime_ms + p.timeZoneOffset_s', 'DESC']
            let sortModel = paginationParams.sortModel

            // pagination not required with .csv
      //      let limit = paginationParams.pageSize
      //      let page = paginationParams.page

            if (sortModel) {
                if (sortModel.field == 'epochTime_ms') {
                    order = ['p.epochTime_ms + p.timeZoneOffset_s', sortModel.sort]
                } else {
                    order = [sortModel.field, sortModel.sort]
                }
            }
           // let dateField = `DATE_FORMAT(FROM_UNIXTIME( p.timeZoneOffset_s + p.epochTime_ms / 1000), '%Y-%m-%d %H:%i:%s')`
            let speedFilterCond = ''

            let isoStartDate = startDate.replace(' ', 'T') + 'Z';
            let startDateObj = new Date(isoStartDate);
            let epochTimeStart_s = Math.floor(startDateObj.getTime() / 1000);

            let isoEndDate = endDate.replace(' ', 'T') + 'Z';
            let endDateObj = new Date(isoEndDate);
            let epochTimeEnd_s = Math.floor(endDateObj.getTime() / 1000);


            let startDateCond = ` AND offsetEpochTime_s >= ${epochTimeStart_s}`;
            let endDateCond = ` AND offsetEpochTime_s <= ${epochTimeEnd_s}`;


            let cameraIdsCond = selectedCameraIds.length > 0 ? ` and p.cameraId IN (${selectedCameraIds.join(',')})` : ' '
            let vehicleCond = selectedVehicleTypes.length > 0 ? ` and p.vehicleClass IN (${selectedVehicleTypes.map(i => '"' + i + '"').join(',')})` : ' '
            if (startSpeed != endSpeed) {
                speedFilterCond = ` and (p.speed_kph IS NULL OR (p.speed_kph >= ${startSpeed} and p.speed_kph <= ${endSpeed})) `
            }
            const where_cond = `
                WHERE 1 ${cameraIdsCond}
                ${startDateCond} ${endDateCond} ${speedFilterCond}  ${vehicleCond}
            `
            let sql = `SELECT count(*) as total_count
                FROM plates p LEFT JOIN cameras c on p.cameraId = c.id
                ${where_cond}
                `
            let total_count = await db.sequelize.query(sql,
                { type: QueryTypes.SELECT });

            total_count = total_count[0] ? total_count[0].total_count : 0
            sql = `SELECT 
            p.id as id, p.plateRead, p.cameraId, p.storageLocation, p.vehicleClass, p.speed_kph, p.plateImageFilename, p.epochTime_ms, p.timeZoneOffset_s,
            c.serialNumber as cameraSerial, c.name as cameraName
            FROM 
                plates p LEFT JOIN cameras c on p.cameraId = c.id
                ${where_cond}
                ORDER BY ${order.join(' ')}
            `
            //  LIMIT ${limit} OFFSET ${page * limit} 

            const plates = await db.sequelize.query(
                sql,
                { type: QueryTypes.SELECT });

            Log.info('\x1b[32m%s\x1b[0m', "Done CSV query");

            if (total_count < 1) {
                return res.status(400).send({ message: "There is no data" });
            }
            if (total_count > 50000) {
                return res.status(500).send({ message: "Maximum number of records (50000) exceeded." });
            } else {
                let dataArray = []
                for (let index = 0; index < plates.length; index++) {
                    const plate = plates[index];
                    const record = {
                        'Id': plate['id'],
                        'Date': moment(plate['epochTime_ms'] + plate['timeZoneOffset_s'] * 1000).utc().format('YYYY-MMM-DD HH:mm:ss'),
                        'Camera Serial': plate['cameraSerial'],
                        'Camera Name': plate['cameraName'],
                        'Plate': plate['plateRead'],
                        'Speed(kph)': plate['speed_kph'],
                    }
                    dataArray.push(record)
                }

                const csvWriter = createCsvWriter({
                    path: 'output.csv',
                    header: Object.keys(dataArray[0]).map(key => ({ id: key, title: key })),
                });
                csvWriter.writeRecords(dataArray)
                    .then(() => {
                        // Send the CSV file as a download

                        // Set headers for CSV download
                        res.setHeader('Content-Type', 'text/csv');
                        res.setHeader('Content-Disposition', 'attachment; filename=output.csv');
                        res.download('output.csv', 'output.csv', (err) => {
                            if (err) {
                                Log.error('Error sending CSV file:', err);
                                res.status(500).send({ message: 'Internal Server Error', error: err });
                            }
                        });

                        Log.info('\x1b[32m%s\x1b[0m', "Done Generate CSV");
                    })
                    .catch((error) => {
                        Log.error('Error writing CSV file:', error);
                        res.status(500).send({ message: 'Internal Server Error', error: error });
                    });
            }

        } catch (error) {
            Log.error(error)
            res.status(500).send({ success: false, error: error, message: 'Server error!' });
        }
    })

    app.post(base_url + "/update_plate_read", async (req, res) => {
        try {
            let { plate_id, plateRead } = req.body

            await db.plate.update({
                plateRead: plateRead
            }, {
                where: {
                    id: plate_id
                }
            })

            res.send(res_code.UPDATE_SUCCESS);
        } catch (error) {
            res.status(500).send({ success: false, error: error });
        }
    })

    /*
        app.get(base_url + '/date_range',
            async (req, res) => {
    
    // MK - mixed units and incredibly slow query
    
                let sql = 'SELECT min(epochTime_ms + timeZoneOffset_s) as min from plates'
                const minDateRes = await db.sequelize.query(
                    sql,
                    { type: QueryTypes.SELECT });
                let minDate = minDateRes[0] ? minDateRes[0].min : null
    
                sql = 'SELECT max(epochTime_ms + timeZoneOffset_s) as max from plates'
    
                let maxDateRes = await db.sequelize.query(
                    sql,
                    { type: QueryTypes.SELECT });
                let maxDate = maxDateRes[0] ? maxDateRes[0].max : null
    
                return res.send({ success: true, minDate, maxDate });
            }
        );
    };
    */


    app.get(base_url + '/date_range', async (req, res) => {

        Log.info('\x1b[32m%s\x1b[0m', "Begin plate date range");


        let sql = 'SELECT MIN(offsetEpochTime_s) AS min, MAX(offsetEpochTime_s) AS max FROM plates';

        try {
            const dateRangeRes = await db.sequelize.query(
                sql,
                { type: QueryTypes.SELECT }
            );

            let minDate = dateRangeRes[0] ? dateRangeRes[0].min * 1000 : null;
            let maxDate = dateRangeRes[0] ? dateRangeRes[0].max * 1000 : null;


            Log.info('\x1b[32m%s\x1b[0m', "End plate date range");


            return res.send({ success: true, minDate, maxDate });


        } catch (error) {
            console.error('Error querying date range:', error);
            return res.status(500).send({ success: false, message: 'Internal server error' });
        }
    });

}