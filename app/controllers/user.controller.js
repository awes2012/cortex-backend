
const db = require("../models");
const CameraLog = db.camera_log;
const Camera = db.camera;
const User = db.user;
const Organization = db.organization;
const TDP = db.tdp;
const ReceivedItemStat = db.received_item_stat;
const ReceivedItem = db.received_item;
const Plate = db.plate;
const Op = db.Sequelize.Op;
const moment = require("moment")

var Common = require("./common.controller.js");
const { AsyncResource } = require("async_hooks");

exports.allAccess = (req, res) => {
  res.status(200).send("Public Content XXX.");
};


// "Boards" - nav-bar items eg: Moderator, Home, User
exports.userBoard = (req, res) => {
  res.status(200).send("User Content.");
};


exports.adminBoard = (req, res) => {
  res.status(200).send("Admin Content.");
};


exports.getCameraTdpList = async (req, res) => {

  try {
    let mac = req.body.mac;
    let paginationParams = req.body.paginationParams;
    let order = ['id', 'DESC'];
    let sortModel = paginationParams.sortModel[0];
    let limit = paginationParams.pageSize;
    let page = paginationParams.page;

    if (sortModel) {
      order = [sortModel.field, sortModel.sort];
    }

    const camID = await Common.getCameraID(mac);

    const total_count = await TDP.count({
      where: { cameraiD: camID },
    });

    const tdpRecs = await TDP.findAll({
      where: { cameraiD: camID },
      order: [order],
      offset: page * limit,
      limit: limit,
    });

    // Assuming addTdpPlateImages can be promisified or is already returning a promise
    // You will need to modify addTdpPlateImages to return a Promise for this to work
    const finalTdpRecords = await Common.addTdpPlateImages(tdpRecs);

    res.send({ error: false, message: 'TDPs for: ' + mac, data: finalTdpRecords, total_count });

  } catch (error) {
    // Handle any errors that might occur
    console.error("Error in getCameraTdpList:", error);
    res.status(500).send({ error: true, message: 'Failed to fetch TDP list' });
  }
};

/*
exports.getCameraTdpList = (req, res) => {

  let mac = req.body.mac;
  let paginationParams = req.body.paginationParams
  let order = ['id', 'DESC']
  let sortModel = paginationParams.sortModel[0]
  let limit = paginationParams.pageSize
  let page = paginationParams.page
  if (sortModel) {
    order = [sortModel.field, sortModel.sort]
  }

  const camID  = await Common.getCameraID(mac);

    TDP.count({
      where: { cameraiD: camID },
    }).then((total_count) => {
      TDP.findAll(
        {
          where: { cameraiD: camID },
          order: [order],
          offset: page * limit,
          limit: limit
        }
      ).then(function (tdpRecs) {


        Common.addTdpPlateImages(tdpRecs, function (finalTdpRecords) {

          res.send({ error: false, message: 'TDPs for: ' + mac, data: finalTdpRecords, total_count });

        });

      });
    })

}
*/



// Assuming Common.getCameraID and Common.addPlateImages have been refactored to return Promises
exports.getCameraPlateList = async (req, res) => {
  try {
    let mac = req.body.mac;
    let paginationParams = req.body.paginationParams;
    let order = ['id', 'DESC'];
    let sortModel = paginationParams.sortModel[0];
    let limit = paginationParams.pageSize;
    let page = paginationParams.page;

    if (sortModel) {
      order = [sortModel.field, sortModel.sort];
    }

    const camID = await Common.getCameraID(mac);

    const total_count = await Plate.count({
      where: { cameraiD: camID },
    });

    const plateRecs = await Plate.findAll({
      where: { cameraiD: camID },
      order: [order],
      offset: page * limit,
      limit: limit,
    });

    if (plateRecs.length === 0) {
      return res.send({ error: false, message: 'Plates for: ' + mac, data: plateRecs });
    }

    const finalPlateRecords = await Common.addPlateImages(plateRecs);

    res.send({ error: false, message: 'Plates for: ' + mac, data: finalPlateRecords, total_count });
  } catch (error) {
    console.error("Error in getCameraPlateList:", error);
    res.status(500).send({ error: true, message: 'Failed to fetch plate list' });
  }
};

/*
exports.getCameraPlateList = (req, res) => {

  let mac = req.body.mac;
  let paginationParams = req.body.paginationParams
  let order = ['id', 'DESC']
  let sortModel = paginationParams.sortModel[0]
  let limit = paginationParams.pageSize
  let page = paginationParams.page
  if (sortModel) {
    order = [sortModel.field, sortModel.sort]
  }

  Common.getCameraID(mac, function (camID) {
    Plate.count({
      where: { cameraiD: camID },
    }).then((total_count) => {
      Plate.findAll(
        {
          where: { cameraiD: camID },
          order: [order],
          offset: page * limit,
          limit: limit
        }
      ).then(function (plateRecs) {

        if (plateRecs.length === 0) {
          res.send({ error: false, message: 'Plates for: ' + mac, data: plateRecs });
        }

        Common.addPlateImages(plateRecs, function (finalPlateRecords) {

          res.send({ error: false, message: 'Plates for: ' + mac, data: finalPlateRecords, total_count });

        });

      });
    })
  });

}
*/


exports.addRoleToUser = async (roleId, userId) => {
  const exist = await db.user_roles.findOne({
    where: {
      roleId: roleId,
      userId: userId
    }
  })
  if (exist) {
    return exist
  } else {
    return await db.user_roles.create({
      roleId: roleId,
      userId: userId
    })
  }
}

exports.getUserReviewStates = async (userId, timeEarliest) => {
  try {

    let whereClause = {
      userId: userId
    };

    if (timeEarliest !== 0) {
      whereClause.timeBeginReview = {
        [Op.gte]: timeEarliest
      };
    }

    const reviews = await db.violation_review.findAll({
      where: whereClause,
      order: [['timeBeginReview', 'ASC']]
    });


    const sessions = [];
    let currentSession = createNewSession();
    let lastReviewEndTime = -1;
    let incompleteReviewsCount = 0;
    const FIFTEEN_MINUTES = 900000; // in milliseconds

    for (let review of reviews) {
      if (!review.timeBeginReview) continue;

      if (review.timeEndReview) {
        const isNewSessionRequired =
          lastReviewEndTime !== -1 &&
          (review.timeBeginReview - lastReviewEndTime) >= FIFTEEN_MINUTES;

        if (isNewSessionRequired) {
          sessions.push(currentSession);
          currentSession = createNewSession();
        }

        updateSession(currentSession, review);
        lastReviewEndTime = review.timeEndReview;
      } else {
        incompleteReviewsCount++;
      }
    }

    // Add the last session if it has any reviews
    if (currentSession.duration > 0 || currentSession.nAccept > 0 || currentSession.nReject > 0) {
      sessions.push(currentSession);
    }

    const totalStats = sessions.reduce((acc, session) => {
      acc.activeTime += session.duration;
      acc.nAccept += session.nAccept;
      acc.nReject += session.nReject;
      return acc;
    }, { activeTime: 0, nAccept: 0, nReject: 0 });

    //     console.log(sessions); // Optional: display the results

    return {
      ...totalStats,
      numbIncomplete: incompleteReviewsCount
    };

  } catch (error) {
    console.error("Error during test:", error);
  }
}

// Helper function to create a new session
function createNewSession() {
  return {
    duration: 0,
    nAccept: 0,
    nReject: 0
  };
}
// Helper function to update the current session based on the review
function updateSession(session, review) {
  session.duration += review.timeEndReview - review.timeBeginReview;
  if ((review.action === 'accepted')  || (review.action === 'issued')) {
      session.nAccept += 1;
  } 
  else {
      session.nReject += 1;
  }
}