
require('dotenv').config();
const db = require("./app/models");

db.sequelize.sync({ alter: true })
  .then(() => console.log('Sync Completed!'))
  .catch((e) => {
    console.info('Sync error!')
    console.info(e)
  })
