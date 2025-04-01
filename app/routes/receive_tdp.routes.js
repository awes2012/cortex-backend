const { verifySignUp } = require("../middleware");
const controller = require("../controllers/receive_tdp.controller");
const base_url = '/api/tdp'
const db = require("@app/models");
const AdmZip = require('adm-zip');
const { s3Client, BUCKET_NAME, getBufferFromS3 } = require('@app/services/aws.service')
const multer = require("multer");
const { downloadDirectoryAsZip } = require("@app/services/appstorage.service");

const upload = multer();

module.exports = function (app) {


  app.post("/tdp", upload.any(), controller.receiveTDP);
  app.get(base_url + "/download_tdp_data/:tdpId", async (req, res) => {
    const tdpId = req.params.tdpId
    const tdp = await db.tdp.findOne({
      where: {
        id: tdpId
      }
    })
    const storageLocation = tdp.storageLocation
    return downloadDirectoryAsZip(storageLocation, res)
  });
};
