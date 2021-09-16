const BN = require("bn.js")
const { sendEther, pow } = require("./util")
const { WETH, WETH_WHALE, DAI, DAI_WHALE, USDC, USDC_WHALE, USDT, USDT_WHALE, LINK, WBTC,} = require("./config")
const config = require("../src/config")

const IERC20 = artifacts.require("IERC20")
const MyV2FlashLoan = artifacts.require("MyV2FlashLoan")

const addressProvider = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5';
const lendingProvider = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9'

contract("MyV2FlashLoan", (accounts) => {
  const zrxOrder = {
  signature: '0x1b60c6fdb184dd9e19a59bbc96bfd22bdc511cdce82482b51c3efcb0f0f7a436be3635cf196e2850167959c15a232229a5c9fdc4afb2ab0b1ab9d0e97f52121e7d03',
  senderAddress: '0x0000000000000000000000000000000000000000',
  makerAddress: '0x2009ee7ad53d4b2e51ae6e9aec452987f7511374',
  takerAddress: '0x0000000000000000000000000000000000000000',
  makerFee: '0',
  takerFee: '0',
  makerAssetAmount: '10000000000',
  takerAssetAmount: '10000000000000000000000',
  makerAssetData: '0xf47261b0000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  takerAssetData: '0xf47261b00000000000000000000000006b175474e89094c44da98b954eedeac495271d0f',
  salt: '63977989380088064470809313442310602381794828528527119224901650842583702200516',
  exchangeAddress: '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
  feeRecipientAddress: '0x86003b044f70dac0abc80ac8957305b6370893ed',
  expirationTimeSeconds: '1629705775',
  makerFeeAssetData: '0x',
  chainId: 1,
  takerFeeAssetData: '0x'
}
  var takerAmount = new BN(zrxOrder.takerAssetAmount)
  var takerFee = new BN(zrxOrder.takerFee)

  const WHALE = WETH_WHALE
  const TOKEN = WETH
  const TOTOKEN = USDC
  const DECIMALS = 18
  const FUND_AMOUNT = pow(10, DECIMALS).mul(new BN(10))
  const BORROW_AMOUNT = pow(10, DECIMALS).mul(new BN(100))

  let testFlashLoan
  let token
  beforeEach(async () => {
    token = await IERC20.at(TOKEN)
    toToken = await IERC20.at(TOTOKEN)
    testFlashLoan = await MyV2FlashLoan.new(addressProvider)
    console.log("contractAddress", testFlashLoan.address)

    //await sendEther(web3, accounts[0], WHALE, 1)

    // send enough token to cover fee
    const bal = await token.balanceOf(WHALE)
    console.log('balance:', bal.toString())
    if (bal.gte(FUND_AMOUNT)) {
      console.log('Funding')
      await token.transfer(testFlashLoan.address, FUND_AMOUNT, {
        from: WHALE,
      })
    }
  })

  it('flash loan', async () => {
    const tx = await testFlashLoan.myFlashLoanCall(token.address, BORROW_AMOUNT, toToken.address, '0x', '0x', {
      from: accounts[0]
    })

    for (const log of tx.logs) {
      console.log(log.args.message, log.args.val.toString())
    }
  })
})