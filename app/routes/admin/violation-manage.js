const { verifySignUp } = require("@app/middleware");
const multer = require("multer");

const base_url = '/api/admin/violations'
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

module.exports = function (app) {

    app.post(base_url + "/search", async (req, res) => {
        try {
            let { paginationParams,
                status,
                selectedCameraIds,
                selectedVehicleTypes,
                selectedViolationTypes,
                startDate, endDate,
                startSpeed, endSpeed } = req.body

            let order = ['t.epochTime_ms + t.timeZoneOffset_s', 'DESC']
            let sortModel = paginationParams.sortModel
            let limit = paginationParams.pageSize
            let page = paginationParams.page

            if (sortModel) {
                if (sortModel.field == 'epochTime_ms') {
                    order = ['t.epochTime_ms + t.timeZoneOffset_s', sortModel.sort]
                } else {
                    order = [sortModel.field, sortModel.sort]
                }
            }
            let statusCond = ''

            //let dateField = `DATE_FORMAT(FROM_UNIXTIME( t.timeZoneOffset_s + t.epochTime_ms / 1000), '%Y-%m-%d %H:%i:%s')`
            let speedFilterCond = ''
            switch (status) {
                case 'incomplete':
                    statusCond = ` and userId IS NOT NULL and action IS NULL`
                    break;
                case 'issued':
                    statusCond = ` and action="issued"`
                    break;
                case 'rejected':
                    statusCond = ` and action="rejected"`
                    break;
                case 'all':
                    statusCond = ` `
                    break;
                default:
                    break;
            }

            let isoStartDate = startDate.replace(' ', 'T') + 'Z';
            let startDateObj = new Date(isoStartDate);
            let epochTimeStart_s = Math.floor(startDateObj.getTime() / 1000);

            let isoEndDate = endDate.replace(' ', 'T') + 'Z';
            let endDateObj = new Date(isoEndDate);
            let epochTimeEnd_s = Math.floor(endDateObj.getTime() / 1000);

            let startDateCond = ` AND offsetEpochTime_s >= ${epochTimeStart_s}`;
            let endDateCond = ` AND offsetEpochTime_s <= ${epochTimeEnd_s}`;



           // let startDateCond = startDate ? ` and (${dateField}) >= '${startDate}'` : ' '
           // let endDateCond = endDate ? ` and (${dateField}) <= '${endDate}'` : ' '
            let cameraIdsCond = selectedCameraIds.length > 0 ? ` and t.cameraId IN (${selectedCameraIds.join(',')})` : ' '
            let violationCond = selectedViolationTypes.length > 0 ? ` and t.violationType IN (${selectedViolationTypes.map(i => '"' + i + '"').join(',')})` : ' '
            let vehicleCond = selectedVehicleTypes.length > 0 ? ` and t.vehicleClass IN (${selectedVehicleTypes.map(i => '"' + i + '"').join(',')})` : ' '
            if (startSpeed != endSpeed) {
                speedFilterCond = ` and (t.speed_kph IS NULL OR (t.speed_kph >= ${startSpeed} and t.speed_kph <= ${endSpeed})) `
            }
            const where_cond = `
                WHERE 1 ${cameraIdsCond} ${statusCond}
                ${startDateCond} ${endDateCond} ${speedFilterCond} ${violationCond} ${vehicleCond}
            `
            let sql = `SELECT count(*) as total_count
                FROM violation_reviews v LEFT JOIN tdps t on v.tdpId = t.id
                ${where_cond}
                `
            let total_count = await db.sequelize.query(sql,
                { type: QueryTypes.SELECT });

            total_count = total_count[0] ? total_count[0].total_count : 0
            sql = `SELECT 
            v.id as id, v.userId, v.tdpId, v.timeEndReview, v.plateRead, v.createdAt, v.stage,
            t.id as tdpId, t.cameraId, t.storageLocation, t.violationType, t.vehicleClass, t.speed_kph, t.epochTime_ms, t.timeZoneOffset_s,
            c.name as camera_name,
            u.username
            FROM 
                violation_reviews v LEFT JOIN tdps t on v.tdpId = t.id 
                LEFT JOIN cameras c on t.cameraId = c.id
                LEFT JOIN users u on v.userId = u.id
                ${where_cond}
                ORDER BY ${order.join(' ')}
            LIMIT ${limit} OFFSET ${page * limit} 
            `
            const violation_reviews = await db.sequelize.query(
                sql,
                { type: QueryTypes.SELECT });

            for (let index = 0; index < violation_reviews.length; index++) {
                const violation = violation_reviews[index];
                const platePath = violation.storageLocation + "/plate.png";
                violation['plateImageUrl'] = await getFileUrlForClient(platePath)
            }
            res.send({ error: false, data: violation_reviews, total_count });
        } catch (error) {
            res.status(500).send({ success: false, error: error });
        }
    })
    app.post(base_url + "/download_csv", async (req, res) => {
        try {
            let { paginationParams,
                status,
                selectedCameraIds,
                selectedVehicleTypes,
                selectedViolationTypes,
                startDate, endDate,
                startSpeed, endSpeed } = req.body

            let order = ['t.epochTime_ms + t.timeZoneOffset_s', 'DESC']
            let sortModel = paginationParams.sortModel
            let limit = paginationParams.pageSize
            let page = paginationParams.page

            if (sortModel) {
                if (sortModel.field == 'epochTime_ms') {
                    order = ['t.epochTime_ms + t.timeZoneOffset_s', sortModel.sort]
                } else {
                    order = [sortModel.field, sortModel.sort]
                }
            }
            let statusCond = ''
            //let dateField = `DATE_FORMAT(FROM_UNIXTIME( t.timeZoneOffset_s + t.epochTime_ms / 1000), '%Y-%m-%d %H:%i:%s')`
            let speedFilterCond = ''

           // let startDateCond = startDate ? ` and (${dateField}) >= '${startDate}'` : ' '
           // let endDateCond = endDate ? ` and (${dateField}) <= '${endDate}'` : ' '

            let isoStartDate = startDate.replace(' ', 'T') + 'Z';
            let startDateObj = new Date(isoStartDate);
            let epochTimeStart_s = Math.floor(startDateObj.getTime() / 1000);

            let isoEndDate = endDate.replace(' ', 'T') + 'Z';
            let endDateObj = new Date(isoEndDate);
            let epochTimeEnd_s = Math.floor(endDateObj.getTime() / 1000);

            let startDateCond = ` AND offsetEpochTime_s >= ${epochTimeStart_s}`;
            let endDateCond = ` AND offsetEpochTime_s <= ${epochTimeEnd_s}`;



            let cameraIdsCond = selectedCameraIds.length > 0 ? ` and t.cameraId IN (${selectedCameraIds.join(',')})` : ' '
            let violationCond = selectedViolationTypes.length > 0 ? ` and t.violationType IN (${selectedViolationTypes.map(i => '"' + i + '"').join(',')})` : ' '
            let vehicleCond = selectedVehicleTypes.length > 0 ? ` and t.vehicleClass IN (${selectedVehicleTypes.map(i => '"' + i + '"').join(',')})` : ' '
            if (startSpeed != endSpeed) {
                speedFilterCond = ` and (t.speed_kph IS NULL OR (t.speed_kph >= ${startSpeed} and t.speed_kph <= ${endSpeed})) `
            }
            const where_cond = `
                WHERE 1 ${cameraIdsCond} ${statusCond}
                ${startDateCond} ${endDateCond} ${speedFilterCond} ${violationCond} ${vehicleCond}
            `


            sql = `SELECT 
            v.id as id, v.userId, v.tdpId, v.plateRead, v.action,
            t.epochTime_ms, t.timeZoneOffset_s, t.speed_kph, t.id as tdpId, t.cameraId, t.violationType, t.vehicleClass, 
            c.serialNumber as cameraSerial, c.name as cameraName,
            u.id as userId, u.username,
            CASE 
                WHEN v.action="issued" THEN 'issued'
                WHEN v.action="rejected" THEN 'rejected'
                WHEN userId IS NOT NULL and v.action IS NULL THEN 'incomplete'
                ELSE 'no assign'
            END AS status
            FROM 
                violation_reviews v LEFT JOIN tdps t on v.tdpId = t.id 
                LEFT JOIN cameras c on t.cameraId = c.id
                LEFT JOIN users u on v.userId = u.id
                ${where_cond}
                ORDER BY ${order.join(' ')}
            `


            const violation_reviews = await db.sequelize.query(
                sql,
                { type: QueryTypes.SELECT });
            let total_count = violation_reviews.length;

            if (total_count > 50000) {
                return res.status(500).send({ message: "Too much data! It's over 50000" });
            } else {
                let dataArray = []
                for (let index = 0; index < violation_reviews.length; index++) {
                    const violation = violation_reviews[index];
                    const record = {
                        'Date': moment(violation['epochTime_ms'] + violation['timeZoneOffset_s'] * 1000).utc().format('YYYY-MMM-DD HH:mm:ss'),
                        'Camera Serial': violation['cameraSerial'],
                        'Camera Name': violation['cameraName'],
                        'Plate': violation['plateRead'],
                        'Speed(kph)': violation['speed_kph'],
                        'ViolationType': violation['violationType'],
                        'Status': violation['status'],
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
    app.post(base_url + "/get_pdf_template", async (req, res) => {
        try {
            let { org_id, contract_id } = req.body
            let data = null
            if (contract_id) {
                data = await db.org_contract.findOne({
                    where: {
                        id: contract_id
                    }
                })
            } else {
                data = await db.organization.findOne({
                    where: {
                        id: org_id
                    }
                })
            }

            res.send({
                pdf_template: data.violation_pdf_template
            });
        } catch (error) {
            console.info(error)
            res.status(500).send({ success: false, error: error });
        }
    })
    app.post(base_url + "/update_pdf_template", async (req, res) => {
        try {
            let { violation_pdf_template, org_id, contract_id } = req.body

            if (contract_id) {
                await db.org_contract.update({
                    violation_pdf_template: violation_pdf_template
                }, {
                    where: {
                        id: contract_id
                    }
                })
            } else {
                await db.organization.update({
                    violation_pdf_template: violation_pdf_template
                }, {
                    where: {
                        id: org_id
                    }
                })
            }

            res.send(res_code.UPDATE_SUCCESS);
        } catch (error) {
            res.status(500).send({ success: false, error: error });
        }
    })
    app.post(base_url + "/update_violation_plate", async (req, res) => {
        try {
            let { violation_review_id, plateRead } = req.body

            await db.violation_review.update({
                plateRead: plateRead
            }, {
                where: {
                    id: violation_review_id
                }
            })

            res.send(res_code.UPDATE_SUCCESS);
        } catch (error) {
            res.status(500).send({ success: false, error: error });
        }
    })


};
