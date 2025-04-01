
const base_url = '/api/admin/contracts'
const { QueryTypes } = require("sequelize");
const db = require("../../models");
const Op = db.Sequelize.Op;

module.exports = function (app) {
    // get contract of a organization
    app.post(
        base_url + '/:org_id',
        async (req, res) => {
            let { org_id } = req.params

            const orgs = await db.org_contract.findAll({
                where: {
                    deleted: false,
                    organizationId: org_id
                }
            })
            return res.send({ data: orgs });
        }
    );
    // get contract by id
    app.get(
        base_url + '/get/:id',
        async (req, res) => {
            let { id } = req.params
            const contract = await db.org_contract.findOne({
                where: {
                    id,
                    deleted: false
                },
                include: [{
                    model: db.organization,
                }]
            })
            return res.send({ data: contract });
        }
    );
    // add contract to organization
    app.post(
        base_url + '/add/:organizationId',
        async (req, res) => {
            let { organizationId } = req.params

            let { name } = req.body
            const duplicateExist = await db.org_contract.count({
                where: {
                    name: name,
                    deleted: false,
                    organizationId: organizationId
                }
            })
            if (duplicateExist > 0) {
                return res.send({
                    success: false,
                    message: 'Duplicated contract name exist.'
                })
            } else {
                await db.org_contract.create({
                    name,
                    organizationId
                })
                return res.send({
                    success: true
                }), 200;
            }

        }
    );
    // edit contract
    app.post(
        base_url + '/edit/:id',
        async (req, res) => {
            let { id } = req.params

            let { name } = req.body
            let data = req.body
            try {

                if (name) {
                    const duplicateExist = await db.org_contract.count({
                        where: {
                            name: name,
                            deleted: false,
                            id: {
                                [Op.ne]: id
                            }
                        }
                    })
                    if (duplicateExist > 0) {
                        return res.send({
                            success: false,
                            message: 'Duplicated contract name exist.'
                        })
                    }
                } else {
                    await db.org_contract.update({
                        ...data
                    }, {
                        where: {
                            id
                        }
                    })
                    return res.send({
                        success: true
                    }), 200;
                }

            } catch (error) {
                return res.send({
                    success: false
                }), 500;
            }

        }
    );

    // update cameras for contract
    app.post(
        base_url + '/:contract_id/edit-cameras',
        async (req, res) => {
            let { contract_id } = req.params

            let { camera_ids } = req.body
            // remove old permissions
            await db.camera.update({
                orgContractId: null
            }, {
                where: {
                    orgContractId: contract_id
                }
            })
            await db.camera.update({
                orgContractId: contract_id
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

    // delete contract
    app.delete(
        base_url + '/delete/:id',
        async (req, res) => {
            let { id } = req.params
            await db.org_contract.update({
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

    // get camera data for contract
    app.get(
        base_url + '/:contract_id/cameras',
        async (req, res) => {
            let { contract_id } = req.params
            const contract = await db.org_contract.findOne({ where: { id: contract_id } })
            if (!contract) {
                return res.status(400).send({
                    message: 'No contract exist'
                })
            } else {
                const cameras = await db.camera.findAll({
                    where: {
                        deleted: false,
                        orgContractId: contract_id
                    },
                })
                return res.send({
                    contract_name: contract.name,
                    cameras: cameras
                });
            }

        }
    );
    // get cameras for organization
    app.get(
        base_url + '/:org_id/org_cameras',
        async (req, res) => {
            let { org_id } = req.params
            const cameras = await db.camera.findAll({
                where: {
                    deleted: false,
                    organizationId: org_id
                },
            })
            return res.send({ data: cameras });
        }
    );
    // get users data for contract
    app.get(
        base_url + '/:contract_id/users',
        async (req, res) => {
            let { contract_id } = req.params
            const contract = await db.org_contract.findOne({ where: { id: contract_id } })
            if (!contract) {
                return res.status(400).send({
                    message: 'No contract exist'
                })
            } else {
                const users = await db.user.findAll({
                    where: {
                        deleted: false,
                        orgContractId: contract_id
                    },
                })
                return res.send({
                    contract_name: contract.name,
                    users: users
                });
            }

        }
    );

    // update users for contract
    app.post(
        base_url + '/:contract_id/edit-users',
        async (req, res) => {
            let { contract_id } = req.params

            let { user_ids } = req.body
            // remove old permissions
            await db.user.update({
                orgContractId: null
            }, {
                where: {
                    orgContractId: contract_id
                }
            })
            await db.user.update({
                orgContractId: contract_id
            }, {
                where: {
                    id: {
                        [Op.in]: user_ids
                    }
                }
            })
            return res.send({
                success: true
            }), 200;

        }
    );

    app.get(
        base_url + '/:contract_id/add-user/:user_id',
        async (req, res) => {
            let { contract_id, user_id } = req.params

            await db.user.update({
                orgContractId: contract_id
            }, {
                where: {
                    id: user_id
                }
            })

            return res.send({
                success: true
            }), 200;

        }
    );
    app.get(
        base_url + '/:contract_id/remove-user/:user_id',
        async (req, res) => {
            let { contract_id, user_id } = req.params

            await db.user.update({
                orgContractId: null
            }, {
                where: {
                    id: user_id
                }
            })

            return res.send({
                success: true
            }), 200;

        }
    );
    app.get(
        base_url + '/:contract_id/add-camera/:camera_id',
        async (req, res) => {
            let { contract_id, camera_id } = req.params

            await db.camera.update({
                orgContractId: contract_id
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
        base_url + '/:contract_id/remove-camera/:camera_id',
        async (req, res) => {
            let { contract_id, camera_id } = req.params

            await db.camera.update({
                orgContractId: null
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
};
