
const base_url = '/api/dashboard'
const { QueryTypes } = require("sequelize");
const db = require("../../models");
const Op = db.Sequelize.Op;
const moment = require('moment');
const { getOrgCamera } = require("../../services/camera.service");
const { getDateStr } = require("../../services/timezone");
const ResCode = require('../res_code')

module.exports = function (app) {

    app.post(
        base_url + '/cameras',
        async (req, res) => {
            let org_id = req.body.org_id
            let org_contract_id = req.body.org_contract_id
            let whereCond = {
                deleted: false
            }
            if (org_id) {
                whereCond.organizationId = org_id
            }
            if (org_contract_id) {
                whereCond.orgContractId = org_contract_id
            }
            const cameras = await db.camera.findAll({
                where: whereCond,
                include: [
                    db.org_contract,
                    db.organization
                ]
            })
            return res.send({ data: cameras });
        }
    );
    app.get(
        base_url + '/org_contracts/:org_id',
        async (req, res) => {
            const org_id = req.params.org_id
            const contracts = await db.org_contract.findAll({
                where: {
                    organizationId: org_id
                },
            })

            return res.send({
                success: true,
                data: contracts
            })
        }
    )
    // apis for vehicle counts
    app.get(
        base_url + '/:org_id/received_item_states',
        async (req, res) => {

            let startDate = req.query.startDate;
            let endDate = req.query.endDate;
            let itemName = req.query.itemName;
            let contractIds = (req.query.contractIds || []).map(c => Number(c));
            let orgId = req.params.org_id
            // get 
            let cameras = await getOrgCamera(orgId)
            if (contractIds.length > 0) {
                cameras = cameras.filter(c => contractIds.includes(c.orgContractId))
            }
            const cameraIds = cameras.map(c => c.id)

            let cameraIdsCond = cameraIds.length > 0 ? ` and r.cameraId IN (${cameraIds.join(',')})` : ' '

            const docs = await db.sequelize.query(
                `select r.id, r.count, r.receivedItemId, r.cameraId, r.local_date_hour, itemName,
                i.vehicleClass,i.violationType
                FROM received_item_stats r LEFT JOIN received_items i on r.receivedItemId = i.id
                WHERE 1 ${cameraIdsCond}
                    and i.itemName = '${itemName}'
                    and r.local_date_hour >= '${startDate}' and r.local_date_hour < '${endDate}'
                    `
            )
            const result = docs[0]
            return res.send({ success: true, data: result, });
        }
    );
    app.get(
        base_url + '/:org_id/received_item_states/range',
        async (req, res) => {

            let orgId = req.params.org_id

            // get 
            const cameras = await getOrgCamera(orgId)
            const cameraIds = cameras.map(c => c.id)

            let cameraIdsCond = cameraIds.length > 0 ? ` and r.cameraId IN (${cameraIds.join(',')})` : ' '

            const docs = await db.sequelize.query(
                `select min(local_date_hour) as minDate, max(local_date_hour) as maxDate
                FROM received_item_stats r LEFT JOIN received_items i on r.receivedItemId = i.id
                WHERE 1 ${cameraIdsCond}
                    `, { type: QueryTypes.SELECT }
            )

            const minDate = docs[0].minDate
            const maxDate = docs[0].maxDate
            return res.send({ success: true, minDate, maxDate });
        }
    );
    // apis for speeds
    app.get(
        base_url + '/:org_id/speed_bin_stats',
        async (req, res) => {

            let startDate = req.query.startDate;
            let endDate = req.query.endDate;

            let contractIds = (req.query.contractIds || []).map(c => Number(c));
            let orgId = req.params.org_id
            // get 
            let cameras = await getOrgCamera(orgId)
            if (contractIds.length > 0) {
                cameras = cameras.filter(c => contractIds.includes(c.orgContractId))
            }
            const cameraIds = cameras.map(c => c.id)

            let cameraIdsCond = cameraIds.length > 0 ? ` and s.cameraId IN (${cameraIds.join(',')})` : ' '

            const query = `select 
                s.id as id, s.count as count, s.receivedItemId as receivedItemId, s.cameraId as cameraId, s.speedBinId as speedBinId, s.local_date_hour,
                r.vehicleClass as vehicleClass, r.violationType as violationType
                FROM speed_bin_stats s LEFT JOIN received_items r on s.receivedItemId = r.id
                WHERE 1 ${cameraIdsCond}
                    and s.local_date_hour >= '${startDate}' and s.local_date_hour < '${endDate}'
                    and r.itemName = 'Plate'
                ORDER BY s.local_date_hour ASC
                    `
            const docs = await db.sequelize.query(
                query
            )
            const result = docs[0]
            return res.send({ success: true, data: result, });
        }
    );
    app.get(
        base_url + '/:org_id/speed_stats',
        async (req, res) => {

            let startDate = req.query.startDate;
            let endDate = req.query.endDate;

            let contractIds = (req.query.contractIds || []).map(c => Number(c));
            let orgId = req.params.org_id
            // get 
            let cameras = await getOrgCamera(orgId)
            if (contractIds.length > 0) {
                cameras = cameras.filter(c => contractIds.includes(c.orgContractId))
            }
            const cameraIds = cameras.map(c => c.id)

            let cameraIdsCond = cameraIds.length > 0 ? ` and s.cameraId IN (${cameraIds.join(',')})` : ' '

            const query = `select 
                s.id as id, s.count as count, s.receivedItemId as receivedItemId, s.cameraId as cameraId, s.sumSpeeds as sumSpeeds, s.local_date_hour,
                r.vehicleClass as vehicleClass, r.violationType as violationType
                FROM speed_stats s LEFT JOIN received_items r on s.receivedItemId = r.id
                WHERE 1 ${cameraIdsCond}
                    and s.local_date_hour >= '${startDate}' and s.local_date_hour < '${endDate}'
                    and r.itemName = 'Plate'
                ORDER BY s.local_date_hour ASC
                    `
            const docs = await db.sequelize.query(
                query
            )
            const result = docs[0]
            return res.send({ success: true, data: result, });
        }
    );
    app.get(
        base_url + '/:org_id/speed_bin_stats/range',
        async (req, res) => {

            let orgId = req.params.org_id

            // get 
            const cameras = await getOrgCamera(orgId)
            const cameraIds = cameras.map(c => c.id)

            let cameraIdsCond = cameraIds.length > 0 ? ` and r.cameraId IN (${cameraIds.join(',')})` : ' '

            const docs = await db.sequelize.query(
                `select min(local_date_hour) as minDate, max(local_date_hour) as maxDate
                FROM speed_bin_stats r LEFT JOIN received_items i on r.receivedItemId = i.id
                WHERE 1 ${cameraIdsCond}
                    `, { type: QueryTypes.SELECT }
            )

            const minDate = docs[0].minDate
            const maxDate = docs[0].maxDate
            return res.send({ success: true, minDate, maxDate });
        }
    );
    app.get(
        base_url + '/:org_id/speed_bins',
        async (req, res) => {

            let data = await db.speed_bin.findAll()
            return res.send({ success: true, data });
        }
    );

    // apis for speed metric
    app.post(
        base_url + '/speed_metric',
        async (req, res) => {

            let { startDate, endDate, camera_ids, vehicle_types } = req.body

            let received_items = await db.received_item.findAll({
                attributes: ['id'],
                where: {
                    vehicleClass: {
                        [Op.in]: vehicle_types
                    },
                    itemName: 'Plate'
                }
            })
            const received_items_ids = received_items.map(item => item.id)
            
            let cameraIdsCond = camera_ids.length > 0 ? ` and cameraId IN (${camera_ids.join(',')})` : ' '
            let received_items_idsCond = received_items_ids.length > 0 ? ` and receivedItemId IN (${received_items_ids.join(',')})` : ' '

            const query = `SELECT * FROM speed_stats
                WHERE 1 ${cameraIdsCond} ${received_items_idsCond}
                and local_date_hour >= '${startDate}' and local_date_hour <= '${endDate}'
                `
            const results = await db.sequelize.query(
                query,
                { type: QueryTypes.SELECT });
            
            let minSpeed = Math.min(...results.map(s => Math.abs(s.min)))
            let maxSpeed = Math.max(...results.map(s => Math.abs(s.max)))
            let totalCount = results.reduce((a, b) => a + b.count, 0)
            let totalSumSpeed = results.reduce((a, b) => a + b.sumSpeeds, 0)
            return res.send({ success: true, minSpeed, maxSpeed, avgSpeed: totalSumSpeed / totalCount });
        }
    );

    // apis for metric
    app.post(
        base_url + '/metrics',
        async (req, res) => {
            let org_id = req.body.org_id
            let org_contract_ids = req.body.org_contract_ids || []
            let start_date = req.body.start_date
            let end_date = req.body.end_date

            let camera_ids = []
            if (org_contract_ids.length > 0) {
                const cameras = await db.camera.findAll({
                    where: {
                        orgContractId: {
                            [Op.in]: org_contract_ids
                        },
                        deleted: false
                    }
                })
                camera_ids = cameras.map(c => c.id)
            } else {
                const cameras = await db.camera.findAll({
                    where: {
                        organizationId: org_id,
                        deleted: false
                    }
                })
                camera_ids = cameras.map(c => c.id)
            }
            let tdp_ids = (await db.received_item.findAll({ where: { itemName: 'TDP' } })).map(d => d.id)
            let plate_ids = (await db.received_item.findAll({ where: { itemName: 'Plate' } })).map(d => d.id)

            if (camera_ids.length > 0) {
                const tdp_data = await db.sequelize.query(
                    `select local_date_hour, sum(count) as count from received_item_stats 
                    where cameraId IN (${camera_ids.join(',')}) and receivedItemId in (${tdp_ids.join(',')})
                        and local_date_hour >= '${start_date}' and local_date_hour <= '${end_date}'
                    group by local_date_hour`
                )
                const plate_data = await db.sequelize.query(
                    `select local_date_hour, sum(count) as count from received_item_stats 
                    where cameraId IN (${camera_ids.join(',')}) and receivedItemId in (${plate_ids.join(',')})
                        and local_date_hour >= '${start_date}' and local_date_hour <= '${end_date}'
                    group by local_date_hour`
                )
                return res.send({
                    tdp_data: tdp_data[0],
                    plate_data: plate_data[0]
                })
            } else {
                return res.send({
                    tdp_data: [],
                    plate_data: []
                })
            }
        }
    );
};
