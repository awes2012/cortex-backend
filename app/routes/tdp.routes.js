const { authJwt } = require("@app/middleware");
//const fs = require('fs');
//const controller = require("@app/controllers/user.controller");
//const { getUserReviewStates } = require("@app/controllers/user.controller");
const db = require("@app/models");
const multer = require('multer');
//const res_code = require("./res_code");
//const { memoryUpload } = require('../services/file.service');
//const path = require("path");
const { validateMacAddress_LC_NoColons, getS3_URLS, getLocalURLs } = require("@app/services/appstorage.service");

const base_url = '/api/tdps';

module.exports = function (app) {
  app.get(base_url + "/:id",
    [authJwt.verifyToken],
    async (req, res) => {
      const id = req.params.id;

      try {
        const doc = await db.tdp.findByPk(id, {
          include: {
            model: db.camera,
            attributes: ['serialNumber', 'name', 'macAddress']
          },
          nest: true,
          raw: true
        });

        if (!doc) {
          return res.status(404).send({
            success: false,
            error: 'Document not found'
          });
        }

        const storageLocation = doc.storageLocation;
        if (!storageLocation) {
          return res.status(400).send({
            success: false,
            error: 'Storage location is missing'
          });
        }

        // if beginning of path is mac address, then S3 storage
        const first12Chars = storageLocation.substring(0, 12);

        // S3 storage - batch process to get URLs
        if (validateMacAddress_LC_NoColons(first12Chars)) {
          
          await getS3_URLS(doc, storageLocation);
        } else {
          
          await getLocalURLs(doc, storageLocation);
        }

        return res.send(doc); 

      } catch (error) {
        console.error('Error fetching document:', error);
        return res.status(500).send({
          success: false,
          error: 'An error occurred while fetching the document'
        });
      }
    }
  );
};

