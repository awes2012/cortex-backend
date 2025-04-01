
const base_url = '/api/admin/organizations'
const { QueryTypes } = require("sequelize");
const db = require("../../models");
const Op = db.Sequelize.Op;
const ResCode = require("../res_code")
const { Log } = require('@app/services/log.service')

module.exports = function (app) {

    app.post(
        base_url + '/',
        async (req, res) => {

            const orgs = await db.organization.findAll({
                where: {
                    deleted: false
                }
            })
            return res.send({ data: orgs });
        }
    );
    app.get(
        base_url + '/get/:id',
        async (req, res) => {
            let { id } = req.params
            const organization = await db.organization.findOne({
                where: {
                    id,
                    deleted: false
                },
                include: [{
                    model: db.camera,
                }, {
                    model: db.org_role
                }]
            })
            return res.send({ data: organization });
        }
    );
    app.post(
        base_url + '/add',
        async (req, res) => {
            let { name, roleName } = req.body
            const duplicateExist = await db.organization.count({
                where: {
                    name: name,
                    deleted: false
                }
            })
            if (duplicateExist > 0) {
                return res.send({
                    success: false,
                    message: 'Duplicated organization name exist.'
                })
            } else {
                const newOrg = await db.organization.create({
                    name
                })
                await db.org_role.create({
                    name: roleName,
                    organizationId: newOrg.id
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

            let data = req.body

            try {
                await db.organization.update({
                    ...data
                }, {
                    where: {
                        id
                    }
                })
                return res.send({
                    success: true
                }), 200;
            } catch (error) {
                return res.send({
                    success: false
                }), 500;
            }

        }
    );
    app.post(
        base_url + '/edit-cameras/:id',
        async (req, res) => {
            let { id } = req.params

            let { camera_ids } = req.body
            // remove old cameras
            await db.camera.update({
                organizationId: null
            }, {
                where: {
                    organizationId: id
                }
            })
            await db.camera.update({
                organizationId: id
            }, {
                where: {
                    id: {
                        [Op.in]: camera_ids
                    }
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
            await db.organization.update({
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

    // get users for organization
    app.get(
        base_url + '/:org_id/org_users',
        async (req, res) => {
            let { org_id } = req.params
            const users = await db.user.findAll({
                where: {
                    deleted: false,
                    organizationId: org_id
                },
                include: db.org_role
            })
            return res.send(users);
        }
    );
    // add role to org user
    app.post(
        base_url + '/:org_id/add_role',
        async (req, res) => {
            let { roleId, userId } = req.body

            const user = await db.user.findOne({ where: { id: userId } })
            const role = await db.org_role.findOne({ where: { id: roleId } })
            try {
                if (user && role) {
                    await user.addOrg_roles(role)
                    return res.status(200).send(ResCode.UPDATE_SUCCESS);
                } else {
                    return res.status(400).send(ResCode.UPDATE_FAIL)
                }
            } catch (error) {
                Log.info('=== error ===', error)
                return res.status(500).send(ResCode.UPDATE_FAIL)
            }

        }
    );

    app.get(
        base_url + '/:org_id/add-camera/:camera_id',
        async (req, res) => {
            let { org_id, camera_id } = req.params

            await db.camera.update({
                organizationId: org_id
            }, {
                where: {
                    id: camera_id
                }
            })

            return res.send({
                success: true
            }), 200;

        }
    );
    app.get(
        base_url + '/:org_id/remove-camera/:camera_id',
        async (req, res) => {
            let { org_id, camera_id } = req.params

            await db.camera.update({
                organizationId: null
            }, {
                where: {
                    id: camera_id
                }
            })


            return res.send({
                success: true
            }), 200;

        }
    );
    // update violation stages 
    app.post(
        base_url + '/edit-violation-stages/:org_id',
        async (req, res) => {
            let { org_id } = req.params

            let { violation_stages } = req.body

            await db.organization.update({
                violation_stages: violation_stages
            }, {
                where: {
                    id: org_id
                }
            })

            return res.send({
                success: true
            }), 200;

        }
    );
};
