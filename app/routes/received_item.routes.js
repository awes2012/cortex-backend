const { verifySignUp } = require("@app/middleware");
const base_url = '/api/received_item'
const db = require("@app/models");
const moment = require('moment')

module.exports = function (app) {
  app.get(base_url + "/all", async (req, res) => {
    const received_items = await db.received_item.findAll()
    return res.send(received_items);
  });

};
