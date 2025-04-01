const { authJwt } = require("@app/middleware");
const fs = require('fs')
const controller = require("@app/controllers/user.controller");
const { getUserReviewStates } = require("@app/controllers/user.controller")
const db = require("@app/models");
const multer = require('multer');
const res_code = require("./res_code");
const { memoryUpload } = require('../services/file.service')
const path = require("path");
const { getFileUrlForClient } = require("@app/services/appstorage.service");



const base_url = '/api/plates'

module.exports = function (app) {
  app.get(base_url + "/:id",
    [authJwt.verifyToken],
    async (req, res) => {

      let id = req.params.id;
      try {
     //   var doc = await db.plate.findByPk(id, { include: db.camera, nest: true, raw: true })
        var doc = await db.plate.findByPk(id, { raw: true })  // June 2024 - table partitioning, no foreign key
        const plateImageName = doc.plateImageFilename
        const irImageName = doc.irImageFilename
        const colImageName = doc.colImageFilename
        let tdpData = doc
        var storageLocation = doc.storageLocation;
        var filePath = ''
        filePath = storageLocation + '/' + plateImageName;
        tdpData.plateImageUrl = plateImageName ? await getFileUrlForClient(filePath) : null

        filePath = storageLocation + '/' + irImageName;
        tdpData.irImageUrl = irImageName ? await getFileUrlForClient(filePath) : null

        filePath = storageLocation + '/' + colImageName;
        tdpData.colImageUrl = colImageName ? await getFileUrlForClient(filePath) : null

        // June 2024 - required due to partitioning
        var Camera = await db.camera.findByPk(doc.cameraId, { raw: true });
        if (Camera) {
          tdpData.camera = Camera;  // Add the Camera object to tdpData
        } else {
          tdpData.camera = null; // If no camera found, set to null or handle accordingly
        }

        return res.send(tdpData)
      } catch (error) {
        console.info(error)
        return res.status(400).send({
          success: false,
          error: error
        })
      }
    }
  )
};
