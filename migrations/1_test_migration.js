const DyDxSoloMargin = artifacts.require("DyDxSoloMargin");

module.exports = function (deployer) {
  deployer.deploy(DyDxSoloMargin);
};