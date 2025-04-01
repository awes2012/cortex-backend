const { verifySignUp } = require("../middleware");
const db = require("../models");
const { authJwt } = require("../middleware");

var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");
const config = require("../config/auth.config.js");
const appconfig = require("../config/app.config")
const { sendEmail } = require("../services/nodemailer.service");
const { addRoleToOrganization } = require("../controllers/organization.controller");
const { addRoleToUser } = require("../controllers/user.controller");
const base_url = '/api/auth'
const { Log } = require('@app/services/log.service');
const { getFileUrlForClient } = require("@app/services/appstorage.service");

module.exports = function (app) {

  app.post(
    "/api/auth/signup",
    [
      verifySignUp.checkDuplicateUsernameOrEmail,
      verifySignUp.checkRolesExisted,
      verifySignUp.organizationExist,
    ],
    async (req, res) => {
      try {
        const organization = await db.organization.findOne({
          where: {
            deleted: false,
            name: req.body.organization
          }
        });
        const adminRole = await addRoleToOrganization(req.body.adminRoleName, organization.id)
        const orgUsers = await db.user.count({
          organizationId: organization.id
        })
        // Save User to Database
        const newUser = await db.user.create({
          username: req.body.username,
          email: req.body.email,
          password: bcrypt.hashSync(req.body.password, 8),
          organizationId: organization.id
        })

        if (orgUsers < 1) { // is first user to organization
          await addRoleToUser(adminRole.id, newUser.id)
        }
        return res.send({ message: "User registered successfully!" });
      } catch (error) {
        return res.status(500).send({ message: error.message });
      }
    },
  );

  app.post("/api/auth/signin", async (req, res) => {
    try {
      const user = await db.user.findOne({
        where: {
          username: req.body.username
        },
        include: [db.organization, db.org_contract]
      })
      if (!user) {
        return res.status(404).send({ message: "User Not found." });
      }

      var passwordIsValid = bcrypt.compareSync(
        req.body.password,
        user.password
      );

      if (!passwordIsValid) {
        return res.status(401).send({
          accessToken: null,
          message: "Invalid Password!"
        });
      }

      return newToken(res, user)
    } catch (error) {
      return res.status(500).send({ message: error.message });
    }

  });
  app.get(base_url + '/refresh', [authJwt.verifyToken], async (req, res) => {
    try {
      const user = await db.user.findOne({
        where: {
          id: req.userId
        },
        include: [db.organization, db.org_contract]
      })
      if (!user || !user.activated) {
        return res.status(404).send({ message: "User Not found." });
      }
      return newToken(res, user)
    } catch (error) {
      return res.status(500).send({ message: error.message });
    }

  });
  app.get(base_url + "/request_recover_password", async (req, res) => {
    try {
      const email = req.query.email
      const user = await db.user.findOne({
        where: {
          email: email
        },
      })
      if (!user) {
        return res.status(404).send({ message: "User Not found." });
      } else {
        var token = jwt.sign({ email: email }, config.secret);

        await db.user.update({
          password_recover_token: token
        }, {
          where: {
            id: user.id
          }
        })
        var reset_url = appconfig.app_base_url + 'reset_password/' + token
        const mailOptions = {
          to: email,
          subject: 'Recover password',
          html: `
          
          Hi ${user.username},

          There was a request to change your password!

          If you did not make this request then please ignore this email.

          Otherwise, please click this link to change your password: <a href='${reset_url}'>Click Here</a>
          `
        }
        const result = await sendEmail(mailOptions)
        return res.status(200).send({ success: true, data: result });
      }


    } catch (error) {
      Log.info('=== error ===', error)
      return res.status(500).send({ message: error.message });
    }

  });
  app.get(base_url + '/validate_recover_token', async (req, res) => {
    try {
      const token = req.query.token
      const user = await db.user.findOne({
        where: {
          password_recover_token: token
        }
      })
      if (user) {
        return res.send({
          success: true
        })
      } else {
        return res.status(404).send({ message: 'Invalid token' })
      }

    } catch (error) {
      return res.status(400).send({ message: error.message });
    }
  })
  app.post(base_url + '/update_password', async (req, res) => {
    try {
      const token = req.body.token
      const password = req.body.password
      const user = await db.user.findOne({
        where: {
          password_recover_token: token
        }
      })
      if (user) {
        await db.user.update({
          password: bcrypt.hashSync(password, 8),
          password_recover_token: null
        }, {
          where: {
            id: user.id
          }
        })
        return res.send({
          success: true
        })
      } else {
        return res.status(404).send({ message: 'Invalid token' })
      }

    } catch (error) {
      return res.status(400).send({ message: error.message });
    }
  })

  async function newToken(res, user) {
    var token = jwt.sign({ id: user.id }, config.secret);

    if (!user.activated) {
      return res.status(401).send({
        accessToken: null,
        message: "User not activated."
      });
    }
    await user.update({
      lastLoggedAt: (new Date())
    })
    const roles = await user.getOrg_roles()
    const rolesWithPermissions = []
    for (index in roles) {
      const permissions = await roles[index].getPermissions()
      rolesWithPermissions.push({
        ...roles[index].get(),
        permissions: permissions
      })
    }
    const {password, ...rest} = user.toJSON();
    res.status(200).send({
      ...rest,
      signature_url: await getFileUrlForClient(user.signature_filename),
      roles: rolesWithPermissions,
      orgContractId: user.orgContractId,
      orgContract: user.org_contract,
      accessToken: token,
    });
  }
};
