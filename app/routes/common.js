const { verifySignUp } = require("../middleware");
const multer = require("multer");

const base_url = '/api/common'
const db = require("../models");
const Op = db.Sequelize.Op
const ResCode = require('./res_code')
const fs = require("fs");
const { QueryTypes } = require("sequelize");
var Common = require("../controllers/common.controller.js");
const { readFileData } = require("../services/file.service");
const { Log } = require('@app/services/log.service');
const { getPreSignedUrlOfS3File, getImageBase64FromS3 } = require("@app/services/aws.service");

module.exports = function (app) {
    app.post(base_url + "/sync_permissions", async (req, res) => {
        try {
            const permissions = req.body
            const docs = await db.permission.findAll({
                where: {
                    deleted: false
                }
            })
            const exist_permissions = docs.map(d => d.name)

            const new_permissions = permissions.filter(p => !exist_permissions.includes(p))

            for (let index = 0; index < new_permissions.length; index++) {
                const permission = new_permissions[index];
                await db.permission.create({
                    name: permission,
                })
            }

            return res.send({
                success: true
            });
        } catch (error) {
            Log.info('=== error ===', error)

            return res.send({
                success: false
            });
        }

    })
    app.get(base_url + "/get_config", async (req, res) => {
        const config = process.env
        res.send({
            SHOW_VEHICLE_CLASS: config.SHOW_VEHICLE_CLASS == '1'
        })
    })
    app.get(base_url + "/get_url_s3_file", async (req, res) => {
        const { path } = req.query
        const url = await getPreSignedUrlOfS3File(path)
        res.send(url)
    })
    app.get(base_url + "/get_base64_s3_file", async (req, res) => {
        const { path } = req.query
        const url = await getImageBase64FromS3(path)
        res.send(url)
    })

    // This returns an image file so long as filepath is valid.  There is no user validation
    app.get(base_url + "/get_local_file", async (req, res) => {
        const { filepath } = req.query

        try {
            await fs.promises.access(filepath, fs.constants.F_OK);
            return res.sendFile(filepath);
        } catch (error) {
            console.info(error)
            return res.send()
    //        return res.sendStatus(404);
        }
    })
};
