const { authJwt } = require("@app/middleware");
const fs = require('fs')
const controller = require("@app/controllers/user.controller");
const { getUserReviewStates } = require("@app/controllers/user.controller")
const db = require("@app/models");
const multer = require('multer');
const res_code = require("./res_code");
const { STORE_ROOT, STORE_DATA_AWS } = require("@app/config/app.config")
const { memoryUpload } = require('../services/file.service')
const path = require("path");
const { saveFile, getFileUrlForClient } = require("@app/services/appstorage.service");



const base_url = '/api/users'

module.exports = function (app) {

  app.get(base_url + "/all", controller.allAccess);

  app.get(base_url + "/user",
    [authJwt.verifyToken],
    controller.userBoard
  );

  /*
  app.get(
    "/api/test/mod",
    [authJwt.verifyToken, authJwt.isModerator],
    controller.moderatorBoard
  );
  */

  app.get(base_url + "/admin",
    [authJwt.verifyToken, authJwt.isAdmin],
    controller.adminBoard
  );

  app.post(base_url + "/cameraTdpList",
    [authJwt.verifyToken],
    controller.getCameraTdpList
  );

  app.post(base_url + "/cameraPlateList",
    [authJwt.verifyToken],
    controller.getCameraPlateList
  );


  app.get(base_url + '/reviewer_state/:user_id',
    async (req, res) => {
      let { user_id } = req.params
      let result = {}
      const user = await db.user.findOne({
        where: {
          id: user_id
        },
        include: [{
          model: db.org_role,
        }]
      })
      result.lastLoggedAt = user.lastLoggedAt
      const nowTimestamp = (new Date()).valueOf()
      const dayMSec = 24 * 3600000
      const all = await getUserReviewStates(user_id, 0)
      const dayState = await getUserReviewStates(user_id, nowTimestamp - dayMSec)
      const weekState = await getUserReviewStates(user_id, nowTimestamp - dayMSec * 7)
      const monthState = await getUserReviewStates(user_id, nowTimestamp - dayMSec * 30)
      result.reviewStates = { all, dayState, weekState, monthState }

      return res.send({ data: result });
    }
  );
  app.post(base_url + '/org_reviewer_state_users',
    async (req, res) => {
      let { org_id } = req.body
      const orgUsers = await db.user.findAll({
        where: {
          organizationId: org_id
        }
      })
      let userResults = []
      for (let index = 0; index < orgUsers.length; index++) {
        const user = orgUsers[index];
        const user_id = user.id
        let result = {}
        result.lastLoggedAt = user.lastLoggedAt
        result.username = user.username
        const nowTimestamp = (new Date()).valueOf()
        const dayMSec = 24 * 3600000
        const all = await getUserReviewStates(user_id, 0)
        const dayState = await getUserReviewStates(user_id, nowTimestamp - dayMSec)
        const weekState = await getUserReviewStates(user_id, nowTimestamp - dayMSec * 7)
        const monthState = await getUserReviewStates(user_id, nowTimestamp - dayMSec * 30)
        result.reviewStates = { all, dayState, weekState, monthState }
        userResults.push(result)
      }

      return res.send({ data: userResults });
    }
  );
  app.post(base_url + '/upload-signature', [authJwt.verifyToken], memoryUpload.single('file'),
    async (req, res) => {
      const { originalname, mimetype, buffer } = req.file;
      const userId = req.userId
      let signaturePath = `signatures/${userId}/${originalname}`
      if (!STORE_DATA_AWS) {
        signaturePath = path.join(STORE_ROOT, signaturePath)
      }

      try {
        await saveFile(buffer, signaturePath)
        await db.user.update({
          signature_filename: signaturePath
        }, {
          where: {
            id: userId
          }
        })
        return res.send({
          signature_url: await getFileUrlForClient(signaturePath)
        })
      } catch (error) {
        console.info(error)
        return res.send(res_code.UPDATE_FAIL), 500
      }
    });
  app.post(base_url + '/office_number', [authJwt.verifyToken],
    async (req, res) => {
      const { office_number } = req.body;
      const userId = req.userId

      try {
        await db.user.update({
          office_number: office_number
        }, {
          where: {
            id: userId
          }
        })
        return res.send(res_code.UPDATE_SUCCESS)
      } catch (error) {
        return res.send(res_code.UPDATE_FAIL), 500
      }
    });
};
