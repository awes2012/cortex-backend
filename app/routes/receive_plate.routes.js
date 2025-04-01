//const { verifySignUp } = require("../middleware");
const controller = require("../controllers/receive_plate.controller");

const multer = require("multer");
const upload = multer();

module.exports = function(app) {


  app.post("/plate", upload.any(), controller.receivePlate);
 

};
