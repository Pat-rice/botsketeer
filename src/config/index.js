const env = process.env.NODE_ENV;

module.exports = require(`./${env}.config.js`);