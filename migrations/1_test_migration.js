const MyV2FlashLoan = artifacts.require("MyV2FlashLoan");

module.exports = function (deployer) {
  const addressProvider = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5';
  deployer.deploy(MyV2FlashLoan, addressProvider);
};