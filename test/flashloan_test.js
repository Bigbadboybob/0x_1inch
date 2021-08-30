const BN = require("bn.js")
const { sendEther, pow } = require("./util")
const { WETH, WETH_WHALE, DAI, DAI_WHALE, USDC, USDC_WHALE, USDT, USDT_WHALE, LINK, WBTC,} = require("./config")
const config = require("../src/config")
const {getQuote, getSwap} = require("../src/1inch")

const IERC20 = artifacts.require("IERC20")
const DyDxSoloMargin = artifacts.require("DyDxSoloMargin")

const SOLO = "0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e"

contract("TestDyDxSoloMargin", (accounts) => {
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

  const WHALE = DAI_WHALE
  const TOKEN = DAI
  const TOTOKEN = USDC
  const DECIMALS = 18
  const FUND_AMOUNT = pow(10, DECIMALS).mul(new BN(10000))
  const BORROW_AMOUNT = takerAmount.add(takerFee)

  let testDyDxSoloMargin
  let token
  beforeEach(async () => {
    token = await IERC20.at(TOKEN)
    toToken = await IERC20.at(TOTOKEN)
    testDyDxSoloMargin = await DyDxSoloMargin.new()
    console.log("contractAddress", testDyDxSoloMargin.address)

    //await sendEther(web3, accounts[0], WHALE, 1)

    // send enough token to cover fee
    const bal = await token.balanceOf(WHALE)
    console.log('balance:', bal.toString())
    if (bal.gte(FUND_AMOUNT)) {
      console.log('Funding')
      await token.transfer(testDyDxSoloMargin.address, FUND_AMOUNT, {
        from: WHALE,
      })
      /*
      await token.transfer(accounts[0], FUND_AMOUNT, {
        from: WHALE,
      })
      */
    }

    const soloBal = await token.balanceOf(SOLO)
    console.log(`solo balance: ${soloBal}`)
    assert(soloBal.gte(BORROW_AMOUNT), "solo < borrow")
  })

  it("flash loan", async () => {
    const orderTuple = [
      zrxOrder.makerAddress,
      zrxOrder.takerAddress,
      zrxOrder.feeRecipientAddress,
      zrxOrder.senderAddress,
      zrxOrder.makerAssetAmount ,
      zrxOrder.takerAssetAmount ,
      zrxOrder.makerFee ,
      zrxOrder.takerFee ,
      zrxOrder.expirationTimeSeconds ,
      zrxOrder.salt ,
      zrxOrder.makerAssetData ,
      zrxOrder.takerAssetData ,
      zrxOrder.makerFeeAssetData ,
      zrxOrder.takerFeeAssetData
    ]
    const signature = zrxOrder.signature

    const data = web3.eth.abi.encodeFunctionCall(config.FILL_ORDER_ABI, [orderTuple, zrxOrder.takerAssetAmount, signature])
    //address flashToken, uint256 flashAmount, address arbToken, bytes calldata zrxData,
    //uint256 uniswapFee, uint256 uniswapMinReturn, uint256 sqrtPriceLimitX96

    var Bal = await token.balanceOf(testDyDxSoloMargin.address)
    var BalWETH = await toToken.balanceOf(testDyDxSoloMargin.address)
    //var Bal = await token.balanceOf(accounts[0])
    //var BalWETH = await toToken.balanceOf(accounts[0])
    console.log('BEFORE')
    console.log('DAI:', Bal.toString())
    console.log('WETH:', BalWETH.toString())
    ETHBal = await web3.eth.getBalance(accounts[0])
    console.log("ETHBAL1:", ETHBal)
    ETHBal = await web3.eth.getBalance(testDyDxSoloMargin.address)
    console.log("ETHBAL1:", ETHBal)

    var BalWETH = await toToken.balanceOf(zrxOrder.makerAddress)
    console.log('MAKER WETH:', BalWETH.toString())
    var startBal = await token.balanceOf(testDyDxSoloMargin.address)
    console.log('STARTBAL:', startBal.toString())

    const inchSwap = await getSwap(toToken.address, token.address, zrxOrder.makerAssetAmount, testDyDxSoloMargin.address)
    const inchData = inchSwap.tx.data
    //console.log(inchSwap)

    console.log(token.address)
    var tx = await testDyDxSoloMargin.initiateFlashLoan(token.address, takerAmount.add(takerFee), toToken.address, data, inchData, {
      from: accounts[0], value: pow(10, 15).mul(new BN(14)), gas: 3000000
    }).then( (err, res) => {
      console.log('Then')
      //console.log('ERROR:', err)
      console.log('RESULT:', res)
      console.log('logs')
      if (err != null) {
        for (const log of err.logs) {
          //console.log(log)
          if(log.args.val != null) {
            console.log(log.args.message, log.args.val.toString())
          }
        }
      }
    }).catch( (err, res) => {
      console.log('catch')
      console.log('ERROR:', err)
      console.log('RESULT:', res)
      if (err != null && err.logs != null) {
        for (const log of err.logs) {
          console.log(log)
          //console.log(log.args.message, log.args.val.toString())
        }
      }
    })
    console.log(`${await testDyDxSoloMargin.flashUser()}`)
    //console.log(tx)

    var Bal = await token.balanceOf(testDyDxSoloMargin.address)
    var BalWETH = await toToken.balanceOf(testDyDxSoloMargin.address)
    //var Bal = await token.balanceOf(accounts[0])
    //var BalWETH = await toToken.balanceOf(accounts[0])
    console.log('AFTER')
    console.log('DAI:', Bal.toString())
    console.log('WETH:', BalWETH.toString())
    ETHBal = await web3.eth.getBalance(accounts[0])
    console.log("ETHBAL2:", ETHBal)
    ETHBal = await web3.eth.getBalance(testDyDxSoloMargin.address)
    console.log("ETHBAL2:", ETHBal)

    tx = await testDyDxSoloMargin.withdrawToken(TOTOKEN)
    tx = await testDyDxSoloMargin.withdrawToken(TOKEN)
    tx = await testDyDxSoloMargin.withdrawEther()
    var Bal = await token.balanceOf(accounts[0])
    console.log('USDC:', Bal.toString())
    var BalMe = await toToken.balanceOf(accounts[0])
    console.log('WBTC:', BalMe.toString())

    /*
    //1INCH TRANSFER
    approval = await toToken.approve(config.INCH_ROUTER_ADDRESS, 800000000)
    console.log('APPROVAL:', approval.logs[0].args.value.toString())
    
    tx = await web3.eth.sendTransaction({to: config.INCH_ROUTER_ADDRESS, data: inchData,
    from: accounts[0], gas: 2000000},
      (err, res) => {
        console.log('ERROR:', err)
        console.log('RESULT:', res)
    })
    approval = await toToken.approve(config.INCH_ROUTER_ADDRESS, 0)
    var Bal = await token.balanceOf(accounts[0])
    console.log('USDC:', Bal.toString())
    var BalMe = await toToken.balanceOf(accounts[0])
    console.log('WBTC:', BalMe.toString())
    var Bal = await token.balanceOf(testDyDxSoloMargin.address)
    console.log('USDC:', Bal.toString())
    */
  })

  /*
  it("loan2", async () => {
    const LINK = '0x514910771af9ca656af840dff83e8264ecf986ca'
    //address flashToken, uint256 flashAmount, address arbToken, bytes calldata zrxData,
    //uint256 uniswapFee, uint256 uniswapMinReturn, uint256 sqrtPriceLimitX96
    const tx = await testDyDxSoloMargin.initiateFlashLoan(token.address, BORROW_AMOUNT, LINK, 2, 300, 500, 2, {
      from: WHALE,
    })

    console.log(`${await testDyDxSoloMargin.flashUser()}`)

    for (const log of tx.logs) {
      console.log(log.args.message, log.args.val.toString())
    }

    console.log(await web3.eth.getBalance(accounts[0]))
  })
  */
})