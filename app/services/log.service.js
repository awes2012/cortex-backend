/*
  Green: \x1b[32m
  Yellow: \x1b[33m
  Blue: \x1b[34m
  Purple/Magenta: \x1b[35m
  Cyan: \x1b[36m
  Red: \x1b[31m
  Reset/Default: \x1b[0m
*/

const log4js = require("log4js");
log4js.configure({
  appenders: { debug: { type: "file", filename: "debug.log", maxLogSize: "10M" } },
  categories: { default: { appenders: ["debug"], level: "debug" } },
});

const logger = log4js.getLogger("debug");
logger.level = "debug";

const Log = {
  log: function (title, data) {
    if(data === undefined)  data = "";
    logger.log(title, data)
    console.log(title, data)
  },
  info: function (title, data) {
    if(data === undefined)  data = "";
    logger.info(title, data)
    console.info(title, data)
  },
  error: function (title, data) {
    if(data === undefined) data = "";
    logger.error(title, data)
    console.error(title, data)
  },
  debug: function (title, data) {
    if(data === undefined) data = "";
    logger.debug(title, data)
    console.debug(title, data)
  },
}
module.exports = {
    Log
}