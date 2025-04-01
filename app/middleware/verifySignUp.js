const db = require("../models");
const User = db.user;
const { Log } = require('@app/services/log.service')

checkDuplicateUsernameOrEmail = (req, res, next) => {
  // Username
  User.findOne({
    where: {
      username: req.body.username
    }
  }).then(user => {
    if (user) {
      res.status(400).send({
        message: "Failed! Username is already in use!"
      });
      return;
    }


    // Email
    User.findOne({
      where: {
        email: req.body.email
      }
    }).then(user => {
      if (user) {
        res.status(400).send({
          message: "Failed! Email is already in use!"
        });
        return;
      }

      next();
    });
  }).catch((err) => {
    Log.debug(err)
    done(null, false, { message: 'Something went wrong trying to authenticate' });
  })

};

checkRolesExisted = async (req, res, next) => {

  const ROLES_LIST = await db.org_role.findAll();
  const ROLES = ROLES_LIST.map(r => r.name)
  if (req.body.roles) {
    for (let i = 0; i < req.body.roles.length; i++) {
      if (!ROLES.includes(req.body.roles[i])) {
        res.status(400).send({
          message: "Failed! Role does not exist = " + req.body.roles[i]
        });
        return;
      }
    }
  }

  next();
};
organizationExist = async (req, res, next) => {

  const ORG_LIST = await db.organization.findAll({
    where: {
      deleted: false
    }
  });
  const org_names = ORG_LIST.map(r => r.name)
  const org_exist = org_names.find(oName => oName == req.body.organization)
  if (!org_exist) {
    res.status(400).send({
      message: `Failed! Organization ${req.body.organization} does not exist`
    });
    return;
  }

  next();
};

const verifySignUp = {
  checkDuplicateUsernameOrEmail: checkDuplicateUsernameOrEmail,
  checkRolesExisted: checkRolesExisted,
  organizationExist
};

module.exports = verifySignUp;
