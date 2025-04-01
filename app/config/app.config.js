
const path = require("path");
var ip = require('ip');

const port = process.env.PORT || 8080
const is_production = process.env.NODE_ENV == 'production'
const protocol = is_production ? 'https://' : 'http://'
const serverAddress = process.env.API_URL;

const VEHICLE_CLASSES = [
    'Bus', 'Car', 'Moto', 'Truck'
  ];

module.exports = {
    app_base_url: process.env.APP_URL,
    camera_log_db_toggle_days: 7,
    IS_PRODUCTION: is_production,
    STORE_ROOT: process.env.STORE_ROOT,
    STORE_DATA_AWS: process.env.STORE_DATA_AWS == 'true', 
    PORT: port,
    SERVER_ADDRESS: serverAddress,
    VEHICLE_CLASSES
};
