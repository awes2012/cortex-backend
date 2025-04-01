
module.exports = function(app) {
    require('./user-manage')(app)
    require('./role-manage')(app)
    require('./permission-manage')(app)
    require('./organization-manage')(app)
    require('./contract-manage')(app)
    require('./camera-manage')(app)
    require('./violation-manage')(app)
    require('./plate-manage')(app)
    require('./server-profile-manage')(app)
}