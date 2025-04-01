module.exports = {

  HOST: process.env.DB_HOST,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD,
  DB: process.env.DB_NAME,
  timezone: 'UTC+0',
  dialect: "mysql",
  pool: {
    max: 50,
    min: 0,
    acquire: 1200000,
    idle: 1000000,
  },

  // required for sequelize db:migrate
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: "mysql",
  },
};

