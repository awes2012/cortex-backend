
const base_url = '/api/admin/permissions'
const { QueryTypes } = require("sequelize");
const db = require("../../models");
const Op = db.Sequelize.Op;

module.exports = function (app) {

    app.post(
        base_url + '/',
        async (req, res) => {
            let whereCond = {
                deleted: false
            }
            const permissions = await db.permission.findAll({
                where: whereCond
            })
            return res.send({ data: permissions });
        }
    );
    app.get(
        base_url + '/get/:id',
        async (req, res) => {
            let { id } = req.params
            const permission = await db.permission.findOne({
                where: {
                    id
                }
            })
            return res.send({ data: permission });
        }
    );
    app.post(
        base_url + '/add',
        async (req, res) => {
            let { name, description } = req.body
            const duplicateExist = await db.permission.count({
                where: {
                    name: name,
                }
            })
            if (duplicateExist > 0) {
                return res.send({
                    success: false,
                    message: 'Duplicated permission name exist.'
                })
            } else {
                await db.permission.create({
                    name, description,
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

            // let { name, description } = req.body
            // const duplicateExist = await db.permission.count({
            //     where: {
            //         name: name,
            //         id: {
            //             [Op.ne]: id
            //         }
            //     }
            // })
            // if (duplicateExist > 0) {
            //     return res.send({
            //         success: false,
            //         message: 'Duplicated permission name exist.'
            //     })
            // } else {
            // }

            await db.permission.update(req.body, {
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
            await db.permission.update({
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
