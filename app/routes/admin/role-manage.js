
const base_url = '/api/admin/roles'
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
            const roles = await db.org_role.findAll({
                where: whereCond
            })
            return res.send({ data: roles });
        }
    );
    app.get(
        base_url + '/get/:id',
        async (req, res) => {
            let { id } = req.params
            const role = await db.org_role.findOne({
                where: {
                    id
                },
                include: [{
                    model: db.permission,
                }]
            })
            return res.send({ data: role });
        }
    );
    app.post(
        base_url + '/add',
        async (req, res) => {
            let { name, org_id } = req.body
            const duplicateExist = await db.org_role.count({
                where: {
                    name: name,
                }
            })
            await db.org_role.create({
                name,
                organizationId: org_id
            })
            return res.send({
                success: true
            }), 200;
        }
    );
    app.post(
        base_url + '/edit/:id',
        async (req, res) => {
            let { id } = req.params

            let { name } = req.body
            const duplicateExist = await db.org_role.count({
                where: {
                    name: name,
                    id: {
                        [Op.ne]: id
                    }
                }
            })
            if (duplicateExist > 0) {
                return res.send({
                    success: false,
                    message: 'Duplicated role name exist.'
                })
            } else {
                await db.org_role.update({
                    name
                }, {
                    where: {
                        id
                    }
                })
                return res.send({
                    success: true
                }), 200;
            }

        }
    );
    app.post(
        base_url + '/edit-permissions/:id',
        async (req, res) => {
            let { id } = req.params

            let { permission_ids } = req.body
            // remove old permissions
            await db.sequelize.query(
                `
                    DELETE FROM role_permissions
                    WHERE roleId=${id}
                `
            )
            if (permission_ids.length > 0) {
                const sqlValues = permission_ids.map(pid => {
                    return `(${id}, ${pid}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
                })
                await db.sequelize.query(
                    `
                    INSERT INTO role_permissions (roleId, permissionId, createdAt, updatedAt)
                    VALUES ${sqlValues.join(',')}
                `
                )
            }

            return res.send({
                success: true
            }), 200;

        }
    );
    app.delete(
        base_url + '/delete/:id',
        async (req, res) => {
            let { id } = req.params
            await db.org_role.update({
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

    app.get(
        base_url + '/:role_id/add-permission/:permission_id',
        async (req, res) => {
            let { role_id, permission_id } = req.params

            // remove old roles
            await db.sequelize.query(
                `
                    DELETE FROM role_permissions
                    WHERE roleId=${role_id} and permissionId=${permission_id}
                `
            )
            await db.sequelize.query(
                `
                    INSERT INTO role_permissions (roleId, permissionId, createdAt, updatedAt)
                    VALUES (${role_id}, ${permission_id}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `
            )

            return res.send({
                success: true
            }), 200;

        }
    );
    app.get(
        base_url + '/:role_id/remove-permission/:permission_id',
        async (req, res) => {
            let { role_id, permission_id } = req.params

            // remove old roles
            await db.sequelize.query(
                `
                    DELETE FROM role_permissions
                    WHERE roleId=${role_id} and permissionId=${permission_id}
                `
            )

            return res.send({
                success: true
            }), 200;

        }
    );
};
