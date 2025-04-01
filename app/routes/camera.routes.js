const { verifySignUp } = require("../middleware");
const controller = require("../controllers/camera_log.controller");
const base_url = '/api/camera_info'
const CONFIG = require("@app/config/app.config");
const ResCode = require('./res_code')
const { readFileData } = require("@app/services/file.service");
const moment = require('moment')
var path = require("path");
const { getCameraWebLink } = require("@app/controllers/common.controller");
const db = require("@app/models");
const { getFileUrlForClient } = require("@app/services/appstorage.service");
const Op = db.Sequelize.Op
const { VEHICLE_CLASSES } = require("@app/config/app.config")

const { Log } = require('@app/services/log.service')


module.exports = function (app) {
  app.post(base_url + "/list", async (req, res) => {
    let { organizationId, orgContractId } = req.body
    if (orgContractId) {
      let cameras = (await db.camera.findAll({ where: { deleted: false, orgContractId: orgContractId } }))
      return res.status(200).send({
        success: true,
        data: cameras
      })
    }
    if (organizationId) {
      let cameras = (await db.camera.findAll({ where: { deleted: false, organizationId: organizationId } }))
      return res.status(200).send({
        success: true,
        data: cameras
      })
    }
    let cameras = (await db.camera.findAll({ where: { deleted: false } }))
    return res.status(200).send({
      success: true,
      data: cameras
    })
  })
  app.post("/diag", controller.diagLog);
  app.get(base_url + '/get_epochtime', async (req, res) => {
    const docs = await db.sequelize.query(
      `SELECT cl.cameraId, cl.epochTime_ms
      FROM cortex.camera_logs cl
      INNER JOIN (
          SELECT MAX(id)
       as maxId
          FROM cortex.camera_logs
          GROUP BY cameraId
      ) AS lastRecords ON cl.id = lastRecords.maxId;`
    )

    const result = docs[0]
    return res.send({
      success: true,
      data: result
    })
  })
  app.get(base_url + "/:cameraId/log", async (req, res) => {
    const cameraId = req.params.cameraId
    const data = await db.camera_log.findAll(
      {
        where: { cameraId: cameraId },
        order: [["id", "DESC"]],
      }
    )
    res.send({ success: true, data: data });
  })

  app.get(base_url + "/:id", async (req, res) => {
    const id = req.params.id
    const camera = await db.camera.findOne({
      where: {
        id
      }
    })
    if (camera) {
      return res.status(200).send({
        success: true,
        data: camera
      })
    } else {
      return res.status(400).send(ResCode.NOT_FOUND)
    }
  })
  app.get(base_url + '/:cameraId/received_item_states',
    async (req, res) => {

      let startDate = req.query.startDate;
      let endDate = req.query.endDate;
      let cameraId = req.params.cameraId
      let whereClause = {
        cameraId: cameraId
      }
      if (startDate && endDate) {
        whereClause.local_date_hour = {
          [Op.gte]: startDate,
          [Op.lte]: endDate,
        }
      } else {
        if (startDate) {
          whereClause.local_date_hour = {
            [Op.gte]: startDate,
          }
        }
        if (endDate) {
          whereClause.local_date_hour = {
            [Op.lte]: endDate,
          }
        }
      }

      const docs = await db.received_item_stat.findAll(
        {
          where: whereClause,
          order: [["local_date_hour", "ASC"]],
          include: [db.received_item, db.camera]
        },
      )

      return res.send({ success: true, data: docs, });
    }
  );
  app.post(base_url + '/:cameraId/update', async (req, res) => {
    const cameraId = req.params.cameraId

    await db.camera.update(req.body, {
      where: {
        id: cameraId
      }
    });
    return res.send({ success: true });
  })
  app.get(base_url + '/:cameraId/received_item_states/range',
    async (req, res) => {

      let cameraId = req.params.cameraId


      let minDate = await db.received_item_stat.min(
        'local_date_hour',
        {
          where: {
            cameraId: cameraId
          },
        },
      )
      let maxDate = await db.received_item_stat.max(
        'local_date_hour',
        {
          where: {
            cameraId: cameraId
          },
        },
      )

      return res.send({ success: true, minDate, maxDate });
    }
  );
  
  app.get(base_url + '/:cameraId/:model/range',
    async (req, res) => {

      let model = req.params.model


      Log.error('\x1b[35m%s\x1b[0m', "Begin get Range for " + model);


      let cameraId = req.params.cameraId

      let modelObj = db.tdp
      switch (model) {
        case 'tdps':
          modelObj = db.tdp
          break;
        case 'plates':
          modelObj = db.plate
          break;
        case 'camera_logs':
          modelObj = db.aggregate_camera_log
          break;
        default:
          break;
      }


      const [minDate, maxDate] = await Promise.all([
        modelObj.min('epochTime_ms', { where: { cameraId } }),
        modelObj.max('epochTime_ms', { where: { cameraId } })
      ]);


      /*
            let minDate = await modelObj.min(
              'epochTime_ms',
              {
                where: {
                  cameraId: cameraId
                },
              },
            )
            let maxDate = await modelObj.max(
              'epochTime_ms',
              {
                where: {
                  cameraId: cameraId
                },
              },
            )
      */

      Log.error('\x1b[35m%s\x1b[0m', "Got Range values");


      return res.send({ success: true, minDate, maxDate });
    }
  );
  app.post(base_url + '/cameraLog/vehicles',
    async (req, res) => {

      let { cameraId, startDate, endDate } = req.body

      const startMoment = moment(startDate)
      const endMoment = moment(endDate)
      const diffDays = endMoment.diff(startMoment, 'days')
      let log_model = diffDays > CONFIG.camera_log_db_toggle_days ? 'aggregate_camera_logs' : 'camera_logs'
      const docs = await db.sequelize.query(
        `select c.VehiclesPerHour, c.epochTime_ms, c.timeZoneOffset_s
            FROM ${log_model} c
            WHERE cameraId = ${cameraId} 
            and c.epochTime_ms >= '${startDate}' and c.epochTime_ms <= '${endDate}'
            order by c.epochTime_ms ASC
          `
      )

      const result = docs[0]
      return res.send({ success: true, data: result, });
    }
  );
  app.post(base_url + '/cameraLog/violation',
    async (req, res) => {

      let { cameraId, startDate, endDate } = req.body

      const startMoment = moment(startDate)
      const endMoment = moment(endDate)
      const diffDays = endMoment.diff(startMoment, 'days')
      let log_model = diffDays > CONFIG.camera_log_db_toggle_days ? 'aggregate_camera_logs' : 'camera_logs'
      const docs = await db.sequelize.query(
        `select c.ViolationsPerHour, c.epochTime_ms, c.timeZoneOffset_s
            FROM ${log_model} c
            WHERE cameraId = ${cameraId} 
            and c.epochTime_ms >= '${startDate}' and c.epochTime_ms <= '${endDate}'
            order by c.epochTime_ms ASC
          `
      )

      const result = docs[0]
      return res.send({ success: true, data: result, });
    }
  );
  app.post(base_url + '/cameraLog/temperature',
    async (req, res) => {

      let { cameraId, startDate, endDate } = req.body

      const startMoment = moment(startDate)
      const endMoment = moment(endDate)
      const diffDays = endMoment.diff(startMoment, 'days')
      let log_model = diffDays > CONFIG.camera_log_db_toggle_days ? 'aggregate_camera_logs' : 'camera_logs'
      const docs = await db.sequelize.query(
        `select c.epochTime_ms, c.cpuTemp, c.tofSensTemp, c.fpgaTemp, c.aiTemp1, c.aiTemp2,c.timeZoneOffset_s
            FROM ${log_model} c
            WHERE cameraId = ${cameraId} 
            and c.epochTime_ms >= '${startDate}' and c.epochTime_ms <= '${endDate}'
            order by c.epochTime_ms ASC
          `
      )

      const result = docs[0]
      return res.send({ success: true, data: result, });
    }
  );
  app.post(base_url + '/cameraLog/telemetry-sent-counts',
    async (req, res) => {

      let { cameraId, startDate, endDate } = req.body

      const startMoment = moment(startDate)
      const endMoment = moment(endDate)
      const diffDays = endMoment.diff(startMoment, 'days')
      let log_model = diffDays > CONFIG.camera_log_db_toggle_days ? 'aggregate_camera_logs' : 'camera_logs'
      const docs = await db.sequelize.query(
        `select c.epochTime_ms, c.completeTdpSent, c.LostTdpSent, c.completeMesgSent, c.lostMesgSent, c.timeZoneOffset_s
            FROM ${log_model} c
            WHERE cameraId = ${cameraId} 
            and c.epochTime_ms >= '${startDate}' and c.epochTime_ms <= '${endDate}'
            order by c.epochTime_ms ASC
          `
      )

      const result = docs[0]
      return res.send({ success: true, data: result, });
    }
  );
  app.post(base_url + '/cameraLog/telemetry-send-transfer-times',
    async (req, res) => {

      let { cameraId, startDate, endDate } = req.body

      const startMoment = moment(startDate)
      const endMoment = moment(endDate)
      const diffDays = endMoment.diff(startMoment, 'days')
      let log_model = diffDays > CONFIG.camera_log_db_toggle_days ? 'aggregate_camera_logs' : 'camera_logs'
      const docs = await db.sequelize.query(
        `select c.epochTime_ms, c.avgTdpXferSec, c.maxTdpXferSec, c.avgPlateXferSec, c.maxPlateXferSec, c.timeZoneOffset_s
            FROM ${log_model} c
            WHERE cameraId = ${cameraId} 
            and c.epochTime_ms >= '${startDate}' and c.epochTime_ms <= '${endDate}'
            order by c.epochTime_ms ASC
          `
      )

      const result = docs[0]
      return res.send({ success: true, data: result, });
    }
  );
  app.post(base_url + '/cameraLog/uptime',
    async (req, res) => {

      let { cameraId, startDate, endDate } = req.body

      const startMoment = moment(startDate)
      const endMoment = moment(endDate)
      const diffDays = endMoment.diff(startMoment, 'days')
      let log_model = diffDays > CONFIG.camera_log_db_toggle_days ? 'aggregate_camera_logs' : 'camera_logs'
      const docs = await db.sequelize.query(
        `select c.epochTime_ms, c.uptime, c.timeZoneOffset_s
            FROM ${log_model} c
            WHERE cameraId = ${cameraId} 
            and c.epochTime_ms >= '${startDate}' and c.epochTime_ms <= '${endDate}'
            order by c.epochTime_ms ASC
          `
      )

      const result = docs[0]
      return res.send({ success: true, data: result, });
    }
  );
  app.post(base_url + '/cameraLog/procrates',
    async (req, res) => {

      let { cameraId, startDate, endDate } = req.body

      const startMoment = moment(startDate)
      const endMoment = moment(endDate)
      const diffDays = endMoment.diff(startMoment, 'days')
      let log_model = diffDays > CONFIG.camera_log_db_toggle_days ? 'aggregate_camera_logs' : 'camera_logs'
      const docs = await db.sequelize.query(
        `select c.epochTime_ms, c.IR, c.Col, c.TOF, c.Proc, c.AI, c.timeZoneOffset_s
            FROM ${log_model} c
            WHERE cameraId = ${cameraId} 
            and c.epochTime_ms >= '${startDate}' and c.epochTime_ms <= '${endDate}'
            order by c.epochTime_ms ASC
          `
      )

      const result = docs[0]
      return res.send({ success: true, data: result, });
    }
  );
  app.post(base_url + '/cameraLog/captureloss',
    async (req, res) => {

      let { cameraId, startDate, endDate } = req.body
      const startMoment = moment(startDate)
      const endMoment = moment(endDate)
      const diffDays = endMoment.diff(startMoment, 'days')
      let log_model = diffDays > CONFIG.camera_log_db_toggle_days ? 'aggregate_camera_logs' : 'camera_logs'
      const docs = await db.sequelize.query(
        `select c.epochTime_ms, c.captLossPerc, c.timeZoneOffset_s
            FROM ${log_model} c
            WHERE cameraId = ${cameraId} 
            and c.epochTime_ms >= '${startDate}' and c.epochTime_ms <= '${endDate}'
            order by c.epochTime_ms ASC
          `
      )

      const result = docs[0]
      return res.send({ success: true, data: result, });
    }
  );
  app.post(base_url + '/cameraLog/voltages',
    async (req, res) => {

      let { cameraId, startDate, endDate } = req.body

      const startMoment = moment(startDate)
      const endMoment = moment(endDate)
      const diffDays = endMoment.diff(startMoment, 'days')
      let log_model = diffDays > CONFIG.camera_log_db_toggle_days ? 'aggregate_camera_logs' : 'camera_logs'
      const docs = await db.sequelize.query(
        `select c.epochTime_ms, c.voltageSrc, c.voltage3_3, c.voltage5_0, c.timeZoneOffset_s
            FROM ${log_model} c
            WHERE cameraId = ${cameraId} 
            and c.epochTime_ms >= '${startDate}' and c.epochTime_ms <= '${endDate}'
            order by c.epochTime_ms ASC
          `
      )

      const result = docs[0]
      return res.send({ success: true, data: result, });
    }
  );

  app.get(base_url + '/telemetry/live_link',
    async (req, res) => {
      const { camera_id } = req.query
      const camera = await db.camera.findOne({ where: { id: camera_id } })
      if (camera) {
        const url = await getCameraWebLink(camera.macAddress)
        return res.send(url)
      } else {
        return res.status(404).send(ResCode.NOT_FOUND)
      }
    })
  app.post(base_url + '/:cameraId/:model',
    async (req, res) => {

      let cameraId = req.params.cameraId
      let model = req.params.model
      let { paginationParams, startDate, endDate, searchTxt, selectedVehicleTypes,
        selectedViolationTypes } = req.body

      let order = ['id', 'DESC']
      let sortModel = paginationParams.sortModel[0]
      let limit = paginationParams.pageSize
      let page = paginationParams.page
      if (sortModel) {
        order = [sortModel.field, sortModel.sort]
      }
      let whereClause = {
        cameraId: cameraId
      }
      if (startDate && endDate) {
        whereClause.epochTime_ms = {
          [Op.gte]: startDate,
          [Op.lte]: endDate,
        }
      } else {
        if (startDate) {
          whereClause.epochTime_ms = {
            [Op.gte]: startDate,
          }
        }
        if (endDate) {
          whereClause.epochTime_ms = {
            [Op.lte]: endDate,
          }
        }
      }
      if (searchTxt) {
        whereClause.plateRead = {
          [Op.like]: '%' + searchTxt + '%'
        }
      }
    //  if (selectedVehicleTypes && selectedVehicleTypes.length > 0) {
    //    whereClause.vehicleClass = {
    //      [Op.in]: selectedVehicleTypes,
    //    }
    //  }


     // June 2024 - Map selected vehicle types to their indices
     const vehicleClassIndexMap = VEHICLE_CLASSES.reduce((acc, vehicleClass, index) => {
        acc[vehicleClass] = index;
        return acc;
      }, {});

      if(selectedVehicleTypes){
        const selectedVehicleIndices = selectedVehicleTypes
        .map(vehicleClass => vehicleClassIndexMap[vehicleClass])
        .filter(index => index !== undefined); // Filter out any undefined indices

    
        if (selectedVehicleIndices.length > 0 && selectedVehicleIndices.length < VEHICLE_CLASSES.length) {
          whereClause.vehicleClassId = {
            [Op.in]: selectedVehicleIndices,
        };
        }
      }
      else{
        let ss=2;
      }
      

      let docs = []
      let total_count = 0
      let modelObj = db.tdp
      switch (model) {
        case 'tdps':
          modelObj = db.tdp
          break;
        case 'plates':
          modelObj = db.plate
          break;
        case 'camera_logs':
          modelObj = db.camera_log
          break;
        default:
          break;
      }
      docs = await modelObj.findAll(
        {
          where: whereClause,
          offset: page * limit,
          limit: limit,
          order: [order],
        },
      )
      total_count = await modelObj.count(
        {
          where: whereClause,
        },
      )
      let results = []
      for (let index = 0; index < docs.length; index++) {
        const doc = docs[index];
        if (doc.storageLocation) {
          let plateImageFilename = ''
          let platePath = doc.storageLocation;
          switch (model) {
            case 'tdps':
              plateImageFilename = "/plate.png";
              break;
            case 'plates':
              plateImageFilename = doc.plateImageFilename;
              break;
            default:
              break;
          }
          try {
            platePath = doc.storageLocation + "/" + plateImageFilename;
            const plateImageUrl = plateImageFilename ? await getFileUrlForClient(platePath) : null

            results.push({
              ...doc.get(),
              // plateImage: fileData,
              plateImageUrl: plateImageUrl
            })
          } catch (error) {
            results.push(doc)
          }
        } else {
          results.push(doc)
        }

      }
      return res.send({ success: true, data: results, total_count });
    }
  );

};
