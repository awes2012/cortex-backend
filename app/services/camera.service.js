
const db = require("../models");

function getOrgCamera(org_id) {
    let whereCond = {
        deleted: false
    }
    if (org_id) {
        whereCond.organizationId = org_id
    }
    return db.camera.findAll({
        where: whereCond,
        include: [
            db.org_contract,
            db.organization
        ]
    })
}

module.exports = {
    getOrgCamera,
}