const BN = require("bn.js")
const { sendEther, pow } = require("./util")
const { WETH, WETH_WHALE, DAI, DAI_WHALE, USDC, USDC_WHALE, USDT, USDT_WHALE, LINK, WBTC,} = require("./config")
const config = require("../src/config")
const {getQuote, getSwap} = require("../src/1inch")

const IERC20 = artifacts.require("IERC20")
const MyV2FlashLoan = artifacts.require("MyV2FlashLoan")

const addressProvider = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5';
const lendingProvider = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9"

contract("MyV2FlashLoan", (accounts) => {
  const zrxOrder = {
    signature: '0x1b0930d785426c30eb43cec3da01860f0b60e97f830bc60a903c3c8383855685726d26a39c0d2276e263a125a9cf3e6c6d27b56dee2b6e4f90d0214f8444f8e08602',
    senderAddress: '0x0000000000000000000000000000000000000000',
    makerAddress: '0xc01353fc3e1ed42719603415a7582ded4d69ed8b',
    takerAddress: '0x0000000000000000000000000000000000000000',
    makerFee: '0',
    takerFee: '0',
    makerAssetAmount: '9975047070252759079714',
    takerAssetAmount: '3117202000000000000',
    makerAssetData: '0xf47261b00000000000000000000000006b175474e89094c44da98b954eedeac495271d0f',
    takerAssetData: '0xf47261b0000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    salt: '42769626479094726060192820148544498547590417741975248718318989278469404634920',
    exchangeAddress: '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
    feeRecipientAddress: '0x86003b044f70dac0abc80ac8957305b6370893ed',
    expirationTimeSeconds: '1631856568',
    makerFeeAssetData: '0x',
    chainId: 1,
    takerFeeAssetData: '0x'
  }
  var takerAmount = new BN(zrxOrder.takerAssetAmount)
  var takerFee = new BN(zrxOrder.takerFee)

  const WHALE = WETH_WHALE
  const TOKEN = WETH
  const TOTOKEN = DAI
  const DECIMALS = 18
  const FUND_AMOUNT = pow(10, DECIMALS).mul(new BN(10))
  const BORROW_AMOUNT = takerAmount.add(takerFee)

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

    var Bal = await token.balanceOf(testFlashLoan.address)
    var BalWETH = await toToken.balanceOf(testFlashLoan.address)
    //var Bal = await token.balanceOf(accounts[0])
    //var BalWETH = await toToken.balanceOf(accounts[0])
    console.log('BEFORE')
    console.log('DAI:', Bal.toString())
    console.log('WETH:', BalWETH.toString())
    ETHBal = await web3.eth.getBalance(accounts[0])
    console.log("ETHBAL1:", ETHBal)
    ETHBal = await web3.eth.getBalance(testFlashLoan.address)
    console.log("ETHBAL1:", ETHBal)

    var BalWETH = await toToken.balanceOf(zrxOrder.makerAddress)
    console.log('MAKER WETH:', BalWETH.toString())
    var startBal = await token.balanceOf(testFlashLoan.address)
    console.log('STARTBAL:', startBal.toString())

    const inchSwap = await getSwap(toToken.address, token.address, zrxOrder.makerAssetAmount, testFlashLoan.address)
    const inchData = inchSwap.tx.data
    //console.log(inchSwap)

    var tx = await testFlashLoan.myFlashLoanCall(token.address, BORROW_AMOUNT, toToken.address, data, inchData, {
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
    //console.log(tx)

    var Bal = await token.balanceOf(testFlashLoan.address)
    var BalWETH = await toToken.balanceOf(testFlashLoan.address)
    //var Bal = await token.balanceOf(accounts[0])
    //var BalWETH = await toToken.balanceOf(accounts[0])
    console.log('AFTER')
    console.log('DAI:', Bal.toString())
    console.log('WETH:', BalWETH.toString())
    ETHBal = await web3.eth.getBalance(accounts[0])
    console.log("ETHBAL2:", ETHBal)
    ETHBal = await web3.eth.getBalance(testFlashLoan.address)
    console.log("ETHBAL2:", ETHBal)

    tx = await testFlashLoan.withdrawToken(TOTOKEN)
    tx = await testFlashLoan.withdrawToken(TOKEN)
    tx = await testFlashLoan.withdrawEther()
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
    var Bal = await token.balanceOf(testFlashLoan.address)
    console.log('USDC:', Bal.toString())
    */
  })

  /*
  it("loan2", async () => {
    const LINK = '0x514910771af9ca656af840dff83e8264ecf986ca'
    //address flashToken, uint256 flashAmount, address arbToken, bytes calldata zrxData,
    //uint256 uniswapFee, uint256 uniswapMinReturn, uint256 sqrtPriceLimitX96
    const tx = await testFlashLoan.initiateFlashLoan(token.address, BORROW_AMOUNT, LINK, 2, 300, 500, 2, {
      from: WHALE,
    })

    console.log(`${await testFlashLoan.flashUser()}`)

    for (const log of tx.logs) {
      console.log(log.args.message, log.args.val.toString())
    }

    console.log(await web3.eth.getBalance(accounts[0]))
  })
  */
})