const { verifySignUp } = require("../middleware");
const multer = require("multer");

const base_url = '/api/violations'
const db = require("@app/models");
const Op = db.Sequelize.Op
const ResCode = require('./res_code')
const fs = require("fs");
const { QueryTypes } = require("sequelize");
var Common = require("@app/controllers/common.controller.js");
const { readFileData, renameFile, memoryUpload } = require("@app/services/file.service");
const { streamVideo } = require("@app/services/video.service");
const { Log } = require('@app/services/log.service')
const { faker } = require('@faker-js/faker');
var path = require("path");
//const { getFileUrlForClient, saveFile, getFileBase64 } = require("@app/services/appstorage.service");
const { STORE_DATA_AWS, STORE_ROOT } = require("@app/config/app.config");
const { getFileUrlForClient, validateMacAddress_LC_NoColons, getS3_URLS, getLocalURLs, saveFile, getFileBase64 } = require("@app/services/appstorage.service");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '_'
        cb(null, uniqueSuffix + file.originalname)
    }
})

const upload = multer({ storage: storage })
module.exports = function (app) {
    app.post(base_url + '/update_vehicle_image', memoryUpload.single('file'), async (req, res) => {
        const { tdpId, violationId } = req.body
        const { originalname, mimetype, buffer } = req.file;

        // const tdp = await db.tdp.findOne({
        //     where: {
        //         id: tdpId
        //     }
        // })
        let signaturePath = `violation_reviews/${violationId}/${originalname}`
        if (!STORE_DATA_AWS) {
            signaturePath = path.join(STORE_ROOT, signaturePath)
        }

        try {
            await saveFile(buffer, signaturePath)

            await db.violation_review.update({
                vehicle_outline_image_name: signaturePath
            }, {
                where: {
                    id: violationId
                }
            })
            return res.send({
                success: true,
                filename: signaturePath
            })
        } catch (error) {
            console.info(error)

            return res.status(500).send({
                success: false,
                message: "Server error!"
            })
        }


    })
    app.post(base_url + '/update_plate_image', memoryUpload.single('file'), async (req, res) => {

        const { tdpId } = req.body
        const tdp = await db.tdp.findOne({
            where: {
                id: tdpId
            }
        })
        const { originalname, mimetype, buffer } = req.file;

        const storageLocation = tdp.storageLocation
        let signaturePath = `${storageLocation}/plate.png`

        try {
            await saveFile(buffer, signaturePath)

            return res.send({
                success: true,
                filename: signaturePath
            })
        } catch (error) {
            console.info(error)

            return res.status(500).send({
                success: false,
                message: "Server error!"
            })
        }

    })
    app.post(base_url + "/list/:orgId", async (req, res) => {

        let { paginationParams, status, orgContractId } = req.body

        let order = ['id', 'DESC']
        let sortModel = paginationParams.sortModel[0]
        let limit = paginationParams.pageSize
        let page = paginationParams.page
        if (sortModel) {
            order = [sortModel.field, sortModel.sort]
        }
        const orgId = req.params.orgId
        let cameras = (await db.camera.findAll({ where: { deleted: false, organizationId: orgId } }))
        if (orgContractId) {
            cameras = cameras.filter(c => c.orgContractId == orgContractId)
        }
        let camera_ids = cameras.map(c => c.id)

        let statusCond = ''
        if (status != 'all') {
            statusCond = ` and action="${status}"`
        }
        let camerasCond = ''
        if (camera_ids.length > 0) {
            camerasCond = `and t.cameraId IN (${camera_ids.join(',')})`
        }
        let total_count = await db.sequelize.query(
            `SELECT count(*) as total_count
            FROM violation_reviews v LEFT JOIN tdps t on v.tdpId = t.id
            WHERE 1 ${camerasCond} ${statusCond}
            `,
            { type: QueryTypes.SELECT });

        total_count = total_count[0] ? total_count[0].total_count : 0

        const violation_reviews = await db.sequelize.query(
            `SELECT 
            v.id as id, v.userId, v.tdpId, v.plateRead,
            t.id as tdpId, t.cameraId, t.storageLocation, v.createdAt, t.violationType, t.speed_kph, t.timeZoneOffset_s,
            c.name as camera_name,
            u.username as user_name
            FROM 
                violation_reviews v LEFT JOIN tdps t on v.tdpId = t.id 
                LEFT JOIN cameras c on t.cameraId = c.id
                LEFT JOIN users u on v.userId = u.id
            WHERE 1 ${camerasCond} ${statusCond}
            ORDER BY ${order.join(' ')}
            LIMIT ${limit} OFFSET ${page * limit} 
            `,
            { type: QueryTypes.SELECT });

        let results = []

        for (let index = 0; index < violation_reviews.length; index++) {
            const violation = violation_reviews[index];
            const platePath = violation.storageLocation + "/plate.png";
            try {
                const fileData = await getFileBase64(platePath)
                results.push({
                    ...doc.get(),
                    plateImage: fileData
                })
            } catch (error) {
                results.push(doc)
            }
        }
        res.send({ error: false, data: results, total_count });
    })


    app.get(base_url + '/get/:tdpId/:stage',
        async (req, res) => {
            const { tdpId, stage } = req.params

            /*
            const violation = await db.sequelize.query(`SELECT 
                v.id, v.userId, v.timeBeginReview, v.timeEndReview, v.plateRead, v.action, v.tdpId, v.pdf_filename, v.notes,
                v.ir_image_pan_x,v.ir_image_pan_y,v.ir_image_scale,v.col_image_pan_x,v.col_image_pan_y,v.col_image_scale, v.dmv_result,
                v.ir_image_bright, v.ir_image_contrast, v.col_image_bright, v.col_image_contrast, v.vehicle_outline_image_name,
                u.username,
                t.storageLocation
                FROM violation_reviews v
                left join users u on v.userId = u.id
                left join tdps t on v.tdpId = t.id
                where tdpId = ${tdpId} and stage = ${stage}
            `, { type: QueryTypes.SELECT });
            */

            const violation = await db.sequelize.query(`SELECT 
                v.id, v.userId, v.timeBeginReview, v.timeEndReview, v.plateRead, v.action, v.tdpId, v.pdf_filename, v.notes,
                v.ir_image_pan_x,v.ir_image_pan_y,v.ir_image_scale,v.col_image_pan_x,v.col_image_pan_y,v.col_image_scale, v.dmv_result,
                v.ir_image_bright, v.ir_image_contrast, v.col_image_bright, v.col_image_contrast, v.vehicle_outline_image_name,
                u.username,
                t.storageLocation, t.irVideoFilename, t.colorVideoFilename, t.vehicleClass, t.speedLimit_kph, 
                t.epochTime_ms, t.timeZoneOffset_s, t.violationType, t.latitude, t.longitude, t.speed_kph,
                c.name, c.serialNumber
                FROM violation_reviews v
                LEFT JOIN users u ON v.userId = u.id
                LEFT JOIN tdps t ON v.tdpId = t.id
                LEFT JOIN cameras c ON t.cameraId = c.id
                WHERE tdpId = ? AND stage = ?
            `, { 
                replacements: [tdpId, stage], 
                type: db.Sequelize.QueryTypes.SELECT 
            });


            let data = violation[0]
            if (data) {

                try {

                    let storageLocation = data.storageLocation;


                     // if beginning of path is mac address, then S3 storage
                    const first12Chars = storageLocation.substring(0, 12);

                    // S3 storage - batch process to get URLs
                    if (validateMacAddress_LC_NoColons(first12Chars)) {
                    
                        await getS3_URLS(data, storageLocation);
                    } else {
                    
                         await getLocalURLs(data, storageLocation);
                    }
                    
                    data.speed_kph = Math.round(data.speed_kph);

                    if (data.vehicle_outline_image_name) {
                        const filePath = data.vehicle_outline_image_name;
                        data.vehicle_outline_image_url = await getFileUrlForClient(filePath)
                    }

                    return res.status(200).send({
                        data: data
                    })
                } catch (error) {
                    return res.status(500).send(ResCode.SERVER_ERROR)
                }

            } else {
                return res.status(404).send(ResCode.NOT_FOUND)
            }

        }
    );

    /*
    app.get(base_url + '/date_range',
        async (req, res) => {
            let dateField = `DATE_FORMAT(FROM_UNIXTIME( timeZoneOffset_s + epochTime_ms / 1000), '%Y-%m-%d %H:%i:%s')`
            let sql = `SELECT min(${dateField}) as minDate, max(${dateField}) as maxDate from tdps`
            let minDateRes = await db.sequelize.query(sql,
                { type: QueryTypes.SELECT });
            let minDate = minDateRes[0].minDate
            let maxDate = minDateRes[0].maxDate

            return res.send({ success: true, minDate, maxDate });
        }
    );
    */

    app.get(base_url + '/date_range',
        async (req, res) => {
            // Query to get min and max of offsetEpochTime_s directly
            let sql = `SELECT MIN(offsetEpochTime_s) AS minEpoch, MAX(offsetEpochTime_s) AS maxEpoch FROM tdps`;
            let epochRangeRes = await db.sequelize.query(sql, { type: QueryTypes.SELECT });
            let minEpoch = epochRangeRes[0].minEpoch;
            let maxEpoch = epochRangeRes[0].maxEpoch;

            // Date-time format:  '%Y-%m-%d %H:%i:%s')
            const formatDate = (epochSec) => {
                return new Date(epochSec * 1000).toISOString()
                    .replace('T', ' ')
                    .replace(/\..+/, '');
            };

            let minDate = formatDate(minEpoch);
            let maxDate = formatDate(maxEpoch);

            return res.send({ success: true, minDate, maxDate });
        }
    );


    let tmpCounter = 100;
    let verboseLogs = false;

    app.post(base_url + "/search", async (req, res) => {

        ++tmpCounter;
        const locCounter = tmpCounter;
       if(verboseLogs) Log.info('\x1b[32m%s\x1b[0m', "Begin Search ID: " + locCounter);


        try {
            let { paginationParams,
                stage,
                status,
                searchTxt,
                startDate, endDate,
                selectedCameraIds, selectedVehicleTypes, selectedViolationTypes, selectedOrgContractIds } = req.body

            let order = ['t.offsetEpochTime_s', 'DESC']
            let sortModel = paginationParams.sortModel
            let limit = paginationParams.pageSize
            let page = paginationParams.page
            if (sortModel) {
                if (sortModel.field == 'epochTime_ms') {
                    order = ['t.offsetEpochTime_s', sortModel.sort]
                } else {
                    order = [sortModel.field, sortModel.sort]
                }
            }
            let statusCond = ''
            let plateRead = 'v.plateRead'
            //let dateField = `DATE_FORMAT(FROM_UNIXTIME( t.timeZoneOffset_s + t.epochTime_ms / 1000), '%Y-%m-%d %H:%i:%s')`
            switch (status) {
                case 'toreview':
                    statusCond = ` and action IS NULL`
                    break;
                case 'all_reviewed':
                    statusCond = ` and (action IS NOT NULL)`
                    break;
                case 'issued':
                    statusCond = ` and action="issued"`
                    break;
                case 'rejected':
                    statusCond = ` and action="rejected"`
                    break;
                case 'accepted':
                    statusCond = ` and action="accepted"`
                    break;
                case 'all':
                    statusCond = ` `
                    break;
                default:
                    break;
            }
            let searchTxtCond = searchTxt ? ` and (${plateRead} LIKE "%${searchTxt}%" and ${plateRead} IS NOT NULL)` : ` `


            //let startDateCond = startDate ? ` and ${dateField} >= "${startDate}"` : ' '
            //let endDateCond = endDate ? ` and ${dateField} <= "${endDate}"` : ' '

            let isoStartDate = startDate.replace(' ', 'T') + 'Z';
            let startDateObj = new Date(isoStartDate);
            let epochTimeStart_s = Math.floor(startDateObj.getTime() / 1000);

            let isoEndDate = endDate.replace(' ', 'T') + 'Z';
            let endDateObj = new Date(isoEndDate);
            let epochTimeEnd_s = Math.floor(endDateObj.getTime() / 1000);

            let startDateCond = ` AND offsetEpochTime_s >= ${epochTimeStart_s}`;
            let endDateCond = ` AND offsetEpochTime_s <= ${epochTimeEnd_s}`;



            let cameraIdsCond = selectedCameraIds.length > 0 ? ` and t.cameraId IN (${selectedCameraIds.join(',')})` : ' '
            let violationTypesCondStr = selectedViolationTypes.map(s => `"${s}"`)
            let violationTypesCond = violationTypesCondStr.length > 0 ? ` and t.violationType IN (${violationTypesCondStr.join(',')})` : ' '
            let selectedVehicleTypesStrs = selectedVehicleTypes.map(s => `"${s}"`)
            let vehicleTypesCond = selectedVehicleTypesStrs.length > 0 ? ` and t.vehicleClass IN (${selectedVehicleTypesStrs.join(',')})` : ' '
            let stageCond = ` and stage = ${stage}`
            let nextStageCond = ` and v.tdpId NOT IN (select tdpId from violation_reviews where stage > ${stage} and action IS NOT NULL)`

            const where_cond = `
                WHERE 1 ${cameraIdsCond} ${statusCond} ${stageCond} ${nextStageCond}
                ${searchTxtCond} ${violationTypesCond} ${vehicleTypesCond}
                ${startDateCond} ${endDateCond} 
            `
            let sql = `SELECT count(*) as total_count
                FROM violation_reviews v LEFT JOIN tdps t on v.tdpId = t.id
                ${where_cond}
                `
            
            const startTime1 = process.hrtime.bigint();
            let total_count = await db.sequelize.query(sql,
                { type: QueryTypes.SELECT });

            total_count = total_count[0] ? total_count[0].total_count : 0

            if(verboseLogs) Log.info("  Search ID: " + locCounter + "  Query 1: " );
            if(verboseLogs) Log.info(sql);
            
            if(verboseLogs){

                let diffTime1 = (process.hrtime.bigint() - startTime1) / BigInt(1000000); // Duration in milliseconds;
                Log.info('\x1b[35m%s\x1b[0m', "Query return count: " + total_count + "  Search ID: " + locCounter + " Time ms: " + diffTime1);

            } 

           
            let startTime2 = process.hrtime.bigint();
            const violation_reviews = await db.sequelize.query(
                `SELECT 
            ${plateRead},
            v.id as id, v.userId, v.tdpId, v.timeEndReview,
            t.id as tdpId, t.cameraId, t.storageLocation, v.createdAt,t.violationType, t.speed_kph, t.timeZoneOffset_s, t.epochTime_ms,
            c.name as camera_name,
            u.username as user_name
            FROM 
                violation_reviews v LEFT JOIN tdps t on v.tdpId = t.id 
                LEFT JOIN cameras c on t.cameraId = c.id
                LEFT JOIN users u on v.userId = u.id
                ${where_cond}
                ORDER BY ${order.join(' ')}
            LIMIT ${limit} OFFSET ${page * limit} 
            `,
                { type: QueryTypes.SELECT });

            
            if(verboseLogs){

                Log.info("  Search ID: " + locCounter + "  Query 2: " );
            
                Log.info(`
                    SELECT 
                        ${plateRead},
                        v.id as id, v.userId, v.tdpId, v.timeEndReview,
                        t.id as tdpId, t.cameraId, t.storageLocation, v.createdAt,t.violationType, t.speed_kph, t.timeZoneOffset_s, t.epochTime_ms,
                        c.name as camera_name,
                        u.username as user_name
                    FROM 
                        violation_reviews v LEFT JOIN tdps t on v.tdpId = t.id 
                        LEFT JOIN cameras c on t.cameraId = c.id
                        LEFT JOIN users u on v.userId = u.id
                        ${where_cond}
                        ORDER BY ${order.join(' ')}
                    LIMIT ${limit} OFFSET ${page * limit}
                `);

                let diffTime2 = (process.hrtime.bigint() - startTime2) / BigInt(1000000); // Duration in milliseconds;
                Log.info('\x1b[35m%s\x1b[0m', "Second query return count: " + violation_reviews.length + "  Search ID: " + locCounter + "  Time ms: " + diffTime2);
                
            }

            for (let index = 0; index < violation_reviews.length; index++) {
                const violation = violation_reviews[index];
                const platePath = violation.storageLocation + "/plate.png";
               // const platePath = path.join(violation.storageLocation, "plate.png");  **N0 - Path delimiters on AWS/Linux differ from Windows

                violation['plateImageUrl'] = await getFileUrlForClient(platePath)
            }
            res.send({ error: false, data: violation_reviews, total_count });
        } catch (error) {
            res.status(500).send({ success: false, error: error });
        }
    })

    // MK a radicle simplification.  Not sure why any filtering is required here
    // original is below xxxx
    app.post(base_url + "/has_tdp_in_filtered_violations", async (req, res) => {

        try {
            let { tdpId,
                stage,
                to_review_search_txt,
                reviewed_search_txt,
                reviewed_filter_status,
                startDate, endDate,
                selectedCameraIds, selectedVehicleTypes, selectedViolationTypes, selectedOrgContractIds } = req.body

            let statusCondToReview = ` and action IS NULL`
            let statusCondReviewed = ` `
            switch (reviewed_filter_status) {
                // case 'toreview':
                //     statusCondReviewed = ` and action IS NULL`
                //     plateRead = 'v.plateRead'
                //     dateField = 'v.createdAt'
                //     break;
                case 'all_reviewed':
                    statusCondReviewed = ` and (action IS NOT NULL)`
                    break;
                case 'issued':
                    statusCondReviewed = ` and action="issued"`
                    break;
                case 'rejected':
                    statusCondReviewed = ` and action="rejected"`
                    break;
                case 'accepted':
                    statusCondReviewed = ` and action="accepted"`
                    break;
                case 'all':
                    statusCondReviewed = ` and (action IS NOT NULL)`
                    break;
                default:
                    break;
            }
           
            let sql = `SELECT count(*) as total_count
                FROM violation_reviews WHERE tdpId = ${tdpId} ${statusCondToReview}` 
                
            
            let to_review_result = await db.sequelize.query(sql,
                { type: QueryTypes.SELECT });

            total_count_to_review = to_review_result[0] ? to_review_result[0].total_count : 0


            let sql2 = `SELECT count(*) as total_count
                FROM violation_reviews WHERE tdpId = ${tdpId} ${statusCondReviewed}` 

            let reviewed_result = await db.sequelize.query(sql2,
                { type: QueryTypes.SELECT });

            total_count_reviewed = reviewed_result[0] ? reviewed_result[0].total_count : 0
            total_count = total_count_to_review + total_count_reviewed
            res.send({ total_count });

        } catch (error) {
            console.info(error)
            res.status(500).send({ success: false, error: error });
        }
    })

    app.post(base_url + "/has_tdp_in_filtered_violationsXXX", async (req, res) => {

        try {
            let { tdpId,
                stage,
                to_review_search_txt,
                reviewed_search_txt,
                reviewed_filter_status,
                startDate, endDate,
                selectedCameraIds, selectedVehicleTypes, selectedViolationTypes, selectedOrgContractIds } = req.body

            let statusCondToReview = ` and action IS NULL`
            let statusCondReviewed = ` `
            let plateRead = 'v.plateRead'
            //let dateField = `DATE_FORMAT(FROM_UNIXTIME( t.timeZoneOffset_s + t.epochTime_ms / 1000), '%Y-%m-%d %H:%i:%s')`
            switch (reviewed_filter_status) {
                // case 'toreview':
                //     statusCondReviewed = ` and action IS NULL`
                //     plateRead = 'v.plateRead'
                //     dateField = 'v.createdAt'
                //     break;
                case 'all_reviewed':
                    statusCondReviewed = ` and (action IS NOT NULL)`
                    break;
                case 'issued':
                    statusCondReviewed = ` and action="issued"`
                    break;
                case 'rejected':
                    statusCondReviewed = ` and action="rejected"`
                    break;
                case 'accepted':
                    statusCondReviewed = ` and action="accepted"`
                    break;
                case 'all':
                    statusCondReviewed = ` and (action IS NOT NULL)`
                    break;
                default:
                    break;
            }
            let searchTxtCond = to_review_search_txt ? ` and (${plateRead} LIKE "%${to_review_search_txt}%" and ${plateRead} IS NOT NULL)` : ` `

            //let startDateCond = startDate ? ` and ${dateField} >= "${startDate}"` : ' '
            //let endDateCond = endDate ? ` and ${dateField} <= "${endDate}"` : ' '

            let isoStartDate = startDate.replace(' ', 'T') + 'Z';
            let startDateObj = new Date(isoStartDate);
            let epochTimeStart_s = Math.floor(startDateObj.getTime() / 1000);

            let isoEndDate = endDate.replace(' ', 'T') + 'Z';
            let endDateObj = new Date(isoEndDate);
            let epochTimeEnd_s = Math.floor(endDateObj.getTime() / 1000);

            let startDateCond = ` AND offsetEpochTime_s >= ${epochTimeStart_s}`;
            let endDateCond = ` AND offsetEpochTime_s <= ${epochTimeEnd_s}`;


            let cameraIdsCond = selectedCameraIds.length > 0 ? ` and t.cameraId IN (${selectedCameraIds.join(',')})` : ' '
            let violationTypesCondStr = selectedViolationTypes.map(s => `"${s}"`)
            let violationTypesCond = violationTypesCondStr.length > 0 ? ` and t.violationType IN (${violationTypesCondStr.join(',')})` : ' '
            let selectedVehicleTypesStrs = selectedVehicleTypes.map(s => `"${s}"`)
            let vehicleTypesCond = selectedVehicleTypesStrs.length > 0 ? ` and t.vehicleClass IN (${selectedVehicleTypesStrs.join(',')})` : ' '
            let stageCond = ` and stage = ${stage}`
            let nextStageCond = ` and v.tdpId NOT IN (select tdpId from violation_reviews where stage > ${stage} and action IS NOT NULL)`

            let where_cond = `
                WHERE 1 ${cameraIdsCond} ${statusCondToReview} ${stageCond} ${nextStageCond}
                ${searchTxtCond} ${violationTypesCond} ${vehicleTypesCond}
                ${startDateCond} ${endDateCond} and tdpId = ${tdpId}
            `
            let sql = `SELECT count(*) as total_count
                FROM violation_reviews v LEFT JOIN tdps t on v.tdpId = t.id
                ${where_cond}
                `
            let to_review_result = await db.sequelize.query(sql,
                { type: QueryTypes.SELECT });

            total_count_to_review = to_review_result[0] ? to_review_result[0].total_count : 0

            searchTxtCond = reviewed_search_txt ? ` and (${plateRead} LIKE "%${reviewed_search_txt}%" and ${plateRead} IS NOT NULL)` : ` `
            where_cond = `
                WHERE 1 ${cameraIdsCond} ${statusCondReviewed} ${stageCond} ${nextStageCond}
                ${searchTxtCond} ${violationTypesCond} ${vehicleTypesCond}
                ${startDateCond} ${endDateCond} and tdpId = ${tdpId}
            `
            sql = `SELECT count(*) as total_count
                FROM violation_reviews v LEFT JOIN tdps t on v.tdpId = t.id
                ${where_cond}
                `

            let reviewed_result = await db.sequelize.query(sql,
                { type: QueryTypes.SELECT });
            total_count_reviewed = reviewed_result[0] ? reviewed_result[0].total_count : 0
            total_count = total_count_to_review + total_count_reviewed
            res.send({ total_count });
        } catch (error) {
            console.info(error)
            res.status(500).send({ success: false, error: error });
        }
    })


    app.get(base_url + "/assign_ticket", async (req, res) => {
        const { user_id, stage } = req.query
        try {
            const user = await db.user.findOne({ where: { id: user_id } })
            if (!user) {
                throw ("User doesn't exist!");
            }
            let camera_ids = []

            if (user.orgContractId) {
                camera_ids = (await db.camera.findAll({ where: { deleted: false, orgContractId: user.orgContractId } })).map(c => c.id)
            } else if (user.organizationId) {
                camera_ids = (await db.camera.findAll({ where: { deleted: false, organizationId: user.organizationId } })).map(c => c.id)
            }
            let camerasCond = ''
            if (camera_ids.length > 0) {
                camerasCond = `and t.cameraId IN (${camera_ids.join(',')})`
            }
            const assignedAndNotHandledViolation = await db.sequelize.query(
                `SELECT v.id as id, v.userId, t.cameraId, t.id as tdpId, v.plateRead
            FROM violation_reviews v LEFT JOIN tdps t on v.tdpId = t.id
            WHERE v.userId = ${user_id} ${camerasCond} and v.stage = ${stage} and action IS NULL
            ORDER BY v.createdAt DESC
            LIMIT 1
            `,
                { type: QueryTypes.SELECT });
            if (assignedAndNotHandledViolation[0]) {
                return res.send({
                    success: true, data: {
                        tdpId: assignedAndNotHandledViolation[0].tdpId
                    }
                })
            } else {

                if (camera_ids.length < 1) {
                    return res.send({
                        success: false, data: {
                            tdpId: null
                        }
                    });
                }
                const availableViolations = await db.sequelize.query(
                    `SELECT v.id as id, v.userId, t.cameraId, t.id as tdpId, v.plateRead
                FROM violation_reviews v LEFT JOIN tdps t on v.tdpId = t.id
                WHERE v.userId IS NULL ${camerasCond} and v.stage = ${stage}
                ORDER BY v.createdAt DESC
                LIMIT 1
                `,
                    { type: QueryTypes.SELECT });


                if (availableViolations.length < 1) {
                    return res.send({
                        success: false, data: {
                            tdpId: null
                        }
                    });
                } else {
                    const tdpId = availableViolations[0].tdpId
                    await db.violation_review.update({
                        userId: user_id,
                        timeBeginReview: new Date(),
                        timeBeginReview: Date.now()
                    }, {
                        where: {
                            tdpId: tdpId,
                            stage: stage
                        }
                    })

                    res.send({
                        success: true, data: {
                            tdpId: tdpId
                        }
                    });
                }
            }
        } catch (error) {
            Log.info('=== error ===', error)
            res.status(404).send({ success: false, error: error });
        }
    })

    // MK simplification - use only 1 query
    app.get(base_url + "/assign_ticket_by_tdpId", async (req, res) => {
        const { user_id, stage, tdpId } = req.query;
    
        try {
            const violation = await db.violation_review.findOne({
                where: { tdpId: Number(tdpId), stage }
            });
    
            if (!violation) {
                return res.status(400).send({
                    success: false,
                    error: 'No violation found for the provided TDP ID'
                });
            }

            if (violation && !violation.action) {
                violation.userId = user_id;
                violation.timeBeginReview = Date.now()
                await violation.save();
            }
    
            return res.send({ success: true });

        } catch (error) {
            console.error(error);
            return res.status(500).send({
                success: false,
                error: 'An error occurred while processing assign_ticket_by_tdpId.'
            });
        }
    });
    

    /*
    app.get(base_url + "/assign_ticket_by_tdpId", async (req, res) => {
        const { user_id, stage, tdpId } = req.query

        const tdp = await db.tdp.findByPk(Number(tdpId))
        if (tdp) {
            const violation = await db.violation_review.findOne({
                where: {
                    tdpId: Number(tdpId),
                    stage,
                }
            })
            if (!violation || !violation.action) { // not handled

                await db.violation_review.update({
                    userId: user_id,
                    timeBeginReview: Date.now()
                }, {
                    where: {
                        tdpId: tdp.id,
                        stage: stage
                    }
                })
        
            }

            return res.send({ success: true })
        } else {
            return res.status(400).send({
                success: false,
                error: 'No TDP EXISTING'
            })
        }
    })
*/

    app.post(base_url + "/action", async (req, res) => {
        const { tdpId, stage, nextStage, ...rest } = req.body

        await db.violation_review.update({
            timeEndReview: Date.now(),
            ...rest
        }, {
            where: {
                tdpId: Number(tdpId),
                stage
            }
        })
        const violation = await db.violation_review.findOne({
            where: {
                tdpId: Number(tdpId),
                stage
            }
        })
        if (nextStage) { // create next step violation review
            await db.violation_review.create({
                plateRead: violation.plateRead,
                pdf_filename: violation.pdf_filename,
                createdAt: violation.createdAt,
                tdpId: Number(tdpId),
                stage: nextStage,
                ir_image_pan_x: violation.ir_image_pan_x,
                ir_image_pan_y: violation.ir_image_pan_y,
                ir_image_scale: violation.ir_image_scale,
                col_image_pan_x: violation.col_image_pan_x,
                col_image_pan_y: violation.col_image_pan_y,
                col_image_scale: violation.col_image_scale,
                dmv_result: violation.dmv_result,
            })
        }
        return res.send({
            success: true
        });

    })
    app.get(base_url + "/cancel_assign", async (req, res) => {
        // const action = req.query.action
        // const tdpId = req.query.tdpId
        // await db.violation.update({
        //     timeBeginReview: null,
        //     timeEndReview: null,
        //     userId: null,
        //     plateRead: null,
        //     action: null
        // }, {
        //     where: {
        //         tdpId: Number(tdpId)
        //     }
        // })
        return res.send({
            success: true
        });

    })
    app.get(base_url + "/update_plate", async (req, res) => {
        const plateRead = req.query.plateRead
        const tdpId = req.query.tdpId
        await db.violation_review.update({
            plateRead: plateRead
        }, {
            where: {
                tdpId: Number(tdpId)
            }
        })
        return res.send({
            success: true
        });

    })
    app.get(base_url + "/lookup_dmv", async (req, res) => {
        try {
            const tdpId = req.query.tdpId
            const dmv_exist = await db.violation_review.findOne({
                where: {
                    dmv_result: {
                        [Op.not]: null
                    },
                    tdpId: Number(tdpId)
                }
            })
            let dmv_result = null
            if (dmv_exist) {
                dmv_result = dmv_exist.dmv_result
            } else {

                const review = await db.violation_review.findOne({
                    where: {
                        tdpId: Number(tdpId)
                    }
                })
                dmv_result = await getDMVDataOfViolation(review)
                await db.violation_review.update({
                    dmv_result: dmv_result
                }, {
                    where: {
                        tdpId: Number(tdpId)
                    }
                })
            }

            return res.send({
                success: true,
                dmv_result: dmv_result
            });
        } catch (error) {
            return res.status(400).send({
                success: false,
                dmv_result: null
            })
        }


    })

    // app.get(base_url + '/tdp_video/:type/:tdpId',
    //     async (req, res) => {

    //         const videoType = req.params.type
    //         const tdpId = req.params.tdpId
    //         const tdp = await db.tdp.findByPk(tdpId)
    //         if (tdp) {

    //             let videoPath = tdp.storageLocation
    //             if (videoType == 'ir') {
    //                 videoPath = path.normalize(videoPath + "/" + tdp.irVideoFilename);
    //             }
    //             if (videoType == 'color') {
    //                 videoPath = path.normalize(videoPath + "/" + tdp.colorVideoFilename);
    //             }
    //             try {
    //                 streamVideo(req, res, videoPath)
    //             } catch (error) {
    //                 res.status(400).send("Not found");
    //             }
    //         } else {
    //             res.status(400).send("Not found");
    //         }
    //     }
    // );
    app.get(base_url + '/get_new_ticket/:userId', async (req, res) => {
        const userId = req.params.userId
        // update next ticket of user
        const newTicket = await updateNextTicket(userId)
        return res.send(newTicket)
    })
    app.get(base_url + '/get_dmv_template/:org_id', async (req, res) => {
        const org_id = req.params.org_id
        const org = await db.organization.findOne({
            where: {
                id: org_id
            },
        })
        // update next ticket of user
        const pythonModulePath = org.pythonModulePath
        const result = await getDMVData(pythonModulePath, '')
        return res.send(result)
    })
    // app.post(base_url + '/upload_pdf', upload.single('file'), async (req, res) => {

    //     return res.send({
    //         success: true,
    //         filename: req.file.filename
    //     })
    // })
    async function getDMVDataOfViolation(violation_review) {
        try {
            const plateRead = violation_review.plateRead
            const user = await db.user.findOne({
                where: {
                    id: violation_review.userId
                },
                include: db.organization
            })
            const organization = user.organization
            const pythonModulePath = organization.pythonModulePath
            const result = await getDMVData(pythonModulePath, plateRead || '')
            return result
        } catch (error) {
            Log.error("Error during conversion:", error);
            return null
        }

    }
    async function getDMVData(pythonModulePath, params) {
        try {
            const pathWithDefault = pythonModulePath || '/var/www/cortexPython/default.py'
            const { spawn } = require('child_process');
            const pythonProcess = spawn('python3', [pathWithDefault, ...params]);
            const promiseForData = new Promise((resolve, reject) => {
                pythonProcess.stdout.on('data', (data) => {
                    const result = JSON.parse(data.toString());
                    resolve(result)
                });

                pythonProcess.stderr.on('data', (data) => {
                    reject(data)
                });
            })
            const result = await promiseForData
            return result
        } catch (error) {
            Log.error("Error during conversion:", error);
            return null
        }

    }

    async function updateNextTicket(user_id) {
        function incrementNumericPart(s) {
            // Check if the string is purely numeric
            if (/^\d+$/.test(s)) {
                return (parseInt(s, 10) + 1).toString();
            }

            // Separate the string into alphabetic and numeric parts
            const match = s.match(/([a-zA-Z]*)(\d+)$/);

            if (!match) {
                return s + '1';
            }

            const alphaPart = match[1];
            const numericPart = match[2];

            // Convert the numeric part to an integer, increment it, and then convert it back to a string
            const incrementedNumericPart = (parseInt(numericPart, 10) + 1).toString();

            // Return the concatenated result
            return alphaPart + incrementedNumericPart;
        }
        try {
            const user = await db.user.findOne({
                where: {
                    id: user_id
                },
                include: [db.organization, db.org_contract]
            })
            const newTicket = incrementNumericPart(user.org_contract?.nextTicket || user.organization?.nextTicket || '')
            if (user.org_contract?.nextTicket) {
                // increase for org_contract
                await db.org_contract.update({
                    nextTicket: newTicket
                }, {
                    where: {
                        id: user.org_contract.id
                    }
                })
            } else {
                // increase for organization
                await db.organization.update({
                    nextTicket: newTicket
                }, {
                    where: {
                        id: user.organization.id
                    }
                })
            }
            return newTicket
        } catch (error) {
            Log.error("Error during conversion:", error);
            return null
        }

    }
};
