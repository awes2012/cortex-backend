
const base_url = '/api/admin/server-profile'
const { QueryTypes } = require("sequelize");
const db = require("../../models");
const Op = db.Sequelize.Op;

module.exports = function (app) {
    
    app.get(
        base_url + '/all',
        async (req, res) => {
            
            const data = await db.server_profile.findAll()
            return res.send({ data: data });
        }
    );
    

};
