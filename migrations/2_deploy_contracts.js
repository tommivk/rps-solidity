const rps = artifacts.require("rps");

module.exports = function (deployer) {
  deployer.deploy(rps);
};
