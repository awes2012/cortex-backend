const { verifySignUp } = require("@app/middleware");
const multer = require("multer");

const base_url = '/api/test'
const db = require("@app/models");
const Op = db.Sequelize.Op
const ResCode = require('./res_code')
const fs = require("fs");
const { QueryTypes } = require("sequelize");
var Common = require("@app/controllers/common.controller.js");
const { readFileData } = require("@app/services/file.service");
const { uploadLocalFileToS3, uploadFileStreamToS3, getPreSignedUrlOfS3File } = require("@app/services/aws.service");
const { Log } = require('@app/services/log.service')

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '_'
        cb(null, uniqueSuffix + file.originalname)
    }
})
const upload = multer({ storage: storage })

module.exports = function (app) {
    app.get(base_url + "/", async (req, res) => {
        try {
            Log.info("Hello world! This is test log")
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

    app.post(base_url + "/aws_s3", upload.single('file'), async (req, res) => {
        try {
            const file = req.file
            const tempFilePath = 'uploads/' + file.filename
            const fileStream = fs.createReadStream(tempFilePath);

            // test filestream to s3 storage
            const s3filepath = "test/" + file.filename
            await uploadFileStreamToS3(fileStream, s3filepath)
            var file_url_for_frontend1 = await getPreSignedUrlOfS3File(s3filepath)
            fs.unlinkSync(tempFilePath);

            // test uploading server local file to s3 storage
            await uploadLocalFileToS3("uploads/Viion Logo.png", "test/Viion Logo.png")
            var file_url_for_frontend2 = await getPreSignedUrlOfS3File("test/Viion Logo.png")

            return res.json({
                url1: file_url_for_frontend1,
                url2: file_url_for_frontend2
            })
        } catch (error) {
            console.info(error)
            return res.status(500).send({
                error
            })
        }
    })
};
