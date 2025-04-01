const db = require("../models");

exports.addRoleToOrganization = async (role_name, org_id) => {
    const exist = await db.org_role.findOne({
        where: {
            name: role_name,
            organizationId: org_id
        }
    })
    if (exist) {
        return exist
    } else {
        return await db.org_role.create({
            name: role_name,
            organizationId: org_id
        })
    }
}