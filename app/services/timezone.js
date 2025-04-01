
const moment = require('moment')

function getDateStr(date) {
    const chinaTimeZone = moment.tz.zonesForCountry('CN')
    startDateM = moment(date).tz(chinaTimeZone[0])
    return startDateM.format()
}

module.exports = {
    getDateStr,
}