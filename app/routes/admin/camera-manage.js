
const base_url = '/api/admin/cameras'
const { QueryTypes } = require("sequelize");
const db = require("../../models");
const Op = db.Sequelize.Op;

module.exports = function (app) {

    app.post(
        base_url + '/',
        async (req, res) => {
            let org_id = req.body.org_id
            let whereCond = {
                deleted: false
            }
            if (org_id) {
                whereCond.organizationId = org_id
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
    app.post(
        base_url + '/unassigned',
        async (req, res) => {

            const cameras = await db.camera.findAll({
                where: {
                    deleted: false,
                    organizationId: null
                }
            })
            return res.send({ data: cameras });
        }
    );
    app.get(
        base_url + '/get/:id',
        async (req, res) => {
            let { id } = req.params
            const camera = await db.camera.findOne({
                where: {
                    id
                }
            })
            return res.send({ data: camera });
        }
    );
    app.post(
        base_url + '/add',
        async (req, res) => {
            let { name, description } = req.body
            const duplicateExist = await db.camera.count({
                where: {
                    name: name
                }
            })
            if (duplicateExist > 0) {
                return res.send({
                    success: false,
                    message: 'Duplicated camera name exist.'
                })
            } else {
                await db.camera.create({
                    name, description
                })
                return res.send({
                    success: true
                }), 200;
            }

        }
    );
    app.post(
        base_url + '/edit/:id',
        async (req, res) => {
            let { id } = req.params
            
            await db.camera.update(req.body, {
                where: {
                    id
                }
            })
            return res.send({
                success: true
            }), 200;

        }
    );
    app.delete(
        base_url + '/delete/:id',
        async (req, res) => {
            let { id } = req.params
            await db.camera.update({
                deleted: true
            }, {
                where: {
                    id
                }
            })
            return res.send({
                success: true
            }), 200;
        }
    );

};
