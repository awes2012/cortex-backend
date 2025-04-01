
const base_url = '/api/admin/users'
const { QueryTypes } = require("sequelize");
const db = require("../../models");
module.exports = function (app) {

    app.post(
        base_url + '/',
        async (req, res) => {
            let paginationParams = req.body.paginationParams
            let org_id = req.body.org_id
            let org_where = ''
            if (org_id) {
                org_where = 'WHERE u.organizationId = ' + org_id
            }
            let order = 'id DESC'
            let sortModel = paginationParams.sortModel[0]
            let limit = paginationParams.pageSize
            let page = paginationParams.page
            if (sortModel) {
                order = `${sortModel.field} ${sortModel.sort}`
            }

            const count_result = await db.sequelize.query(
                `SELECT count(*) as total_count
                FROM users u LEFT JOIN organizations o on u.organizationId = o.id
                LEFT JOIN org_contracts c on u.orgContractId = c.id
                ${org_where}
                `,
                { type: QueryTypes.SELECT });
            const total_count = count_result[0].total_count

            const allUsers = await db.sequelize.query(
                `SELECT u.id as id, u.username as username, u.email as email, u.activated as activated, u.createdAt as createdAt,
                o.name as organization_name, c.name as contract_name 
                FROM users u LEFT JOIN organizations o on u.organizationId = o.id
                LEFT JOIN org_contracts c on u.orgContractId = c.id
                ${org_where}
                ORDER BY ${order}
                LIMIT ${limit} OFFSET ${page * limit} 
                `,
                { type: QueryTypes.SELECT });
            const userRoles = await db.sequelize.query(
                `SELECT *
                FROM user_roles u
                LEFT JOIN org_roles o on u.roleId = o.id
                `,
                { type: QueryTypes.SELECT });
            return res.send({ data: allUsers, total_count, userRoles: userRoles });
        }
    );
    app.put(
        base_url + '/:id',
        async (req, res) => {
            let { id } = req.params
            let newdata = req.body

            await db.user.update({
                ...newdata
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
        base_url + '/get/:id',
        async (req, res) => {
            let { id } = req.params
            const user = await db.user.findOne({
                where: {
                    id
                },
                include: [{
                    model: db.org_role,
                }]
            })
            return res.send({ data: user });
        }
    );
    app.post(
        base_url + '/:id/edit-roles',
        async (req, res) => {
            let { id } = req.params

            let { role_ids } = req.body
            // remove old roles
            await db.sequelize.query(
                `
                    DELETE FROM user_roles
                    WHERE userId=${id}
                `
            )
            if (role_ids.length > 0) {
                const sqlValues = role_ids.map(pid => {
                    return `(${id}, ${pid}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
                })
                await db.sequelize.query(
                    `
                    INSERT INTO user_roles (userId, roleId, createdAt, updatedAt)
                    VALUES ${sqlValues.join(',')}
                `
                )
            }

            return res.send({
                success: true
            }), 200;

        }
    );
    app.get(
        base_url + '/:user_id/add-role/:role_id',
        async (req, res) => {
            let { user_id, role_id } = req.params

            // remove old roles
            await db.sequelize.query(
                `
                    DELETE FROM user_roles
                    WHERE userId=${user_id} and roleId=${role_id}
                `
            )
            await db.sequelize.query(
                `
                    INSERT INTO user_roles (userId, roleId, createdAt, updatedAt)
                    VALUES (${user_id}, ${role_id}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `
            )

            return res.send({
                success: true
            }), 200;

        }
    );
    app.get(
        base_url + '/:user_id/remove-role/:role_id',
        async (req, res) => {
            let { user_id, role_id } = req.params

            // remove old roles
            await db.sequelize.query(
                `
                    DELETE FROM user_roles
                    WHERE userId=${user_id} and roleId=${role_id}
                `
            )

            return res.send({
                success: true
            }), 200;

        }
    );

};
