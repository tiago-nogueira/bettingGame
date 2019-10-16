const Betting = artifacts.require("Betting");
const config = require("../config.js");

module.exports = function(deployer) {
  deployer.deploy(Betting, config.time, config.bet);
};
