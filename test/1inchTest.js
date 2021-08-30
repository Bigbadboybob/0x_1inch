const BN = require("bn.js")
const { sendEther, pow } = require("./util")
const { WETH, DAI, DAI_WHALE, WETH_WHALE, USDC, USDC_WHALE, USDT, USDT_WHALE } = require("./config")
const config = require("../src/config")
const {getQuote, getSwap} = require("../src/1inch")
var Web3 = require('web3');
const {
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');
const { web3 } = require("@openzeppelin/test-helpers/src/setup");

const IERC20 = artifacts.require("IERC20")
const DyDxSoloMargin = artifacts.require("DyDxSoloMargin")

const SOLO = "0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e"

contract("TestDyDxSoloMargin", (accounts) => {
  const WHALE = WETH_WHALE
  const TOKEN = WETH
  const DECIMALS = 18
  const FUND_AMOUNT = pow(10, DECIMALS).mul(new BN(110))
  const BORROW_AMOUNT = pow(10, DECIMALS).mul(new BN(100))

  let testDyDxSoloMargin
  let token
  beforeEach(async () => {
    token = await IERC20.at(TOKEN)
    toToken = await IERC20.at(USDC)
    testDyDxSoloMargin = await DyDxSoloMargin.new()
    console.log("contractAddress", testDyDxSoloMargin.address)

    await sendEther(web3, accounts[1], WHALE, 1)

    // send enough token to cover fee
    const bal = await token.balanceOf(WHALE)
    console.log('BALANCE', bal.toString())
    if (bal.gte(FUND_AMOUNT)) {
      await token.transfer(testDyDxSoloMargin.address, FUND_AMOUNT, {
        from: WHALE,
      })
      await token.transfer(accounts[0], FUND_AMOUNT, {
        from: WHALE,
      })
    }

    const soloBal = await token.balanceOf(SOLO)
    console.log(`solo balance: ${soloBal}`)
    assert(soloBal.gte(BORROW_AMOUNT), "solo < borrow")
  })

  it("zrxOrder", async () => {
    inchSwap = await getSwap(WETH, USDC, 10**20, testDyDxSoloMargin.address)
    data = inchSwap.tx.data

    var Bal = await toToken.balanceOf(testDyDxSoloMargin.address)
    var BalWETH = await token.balanceOf(testDyDxSoloMargin.address)
    //var Bal = await toToken.balanceOf(accounts[0])
    //var BalWETH = await token.balanceOf(accounts[0])
    console.log('BEFORE')
    console.log('WETH:', BalWETH.toString())
    console.log('USDC:', Bal.toString())
    ETHBal = await web3.eth.getBalance(accounts[0])
    console.log("ETHBAL1:", ETHBal)
    ETHBal = await web3.eth.getBalance(testDyDxSoloMargin.address)
    console.log("ETHBAL1:", ETHBal)

    //approval = await token.approve(config.INCH_ROUTER_ADDRESS, BORROW_AMOUNT)
    //console.log('APPROVAL:', approval.logs[0].args.value.toString())
    
    /*
    const tx = await web3.eth.sendTransaction({to: config.INCH_ROUTER_ADDRESS, data: data,
    from: accounts[0], gas: 2000000},
      (err, res) => {
        console.log('ERROR:', err)
        console.log('RESULT:', res)
    })
    */
    
    const tx = await testDyDxSoloMargin.inchSwap(token.address, BORROW_AMOUNT, data, {
      from: accounts[0], gas: 2000000
    }).then( (err, res) => {
      console.log('Then')
      console.log('ERROR:', err)
      console.log('RESULT:', res)
      console.log('logs')
      if (err) {
        for (const log of err.logs) {
          //console.log(log)
          console.log(log.args.message, log.args.val.toString())
        }
      }
    }).catch( (err, res) => {
      console.log('catch')
      
      if (err != null) {
        //console.log('ERROR:', err)
        //console.log('RESULT:', res)
        for (const log of err.logs) {
          console.log(log.args.message, log.args.val.toString())
        }
      }
      
    })
    //console.log(tx)
    
    

    //token.approve(config.INCH_ROUTER_ADDRESS, 0)
    //console.log(`${await testDyDxSoloMargin.flashUser()}`)

    
    
    /*
    console.log('logs')
    for (const log of tx.logs) {
      console.log(log.args.message, log.args.val.toString())
    }
    */
    
    

    var Bal = await toToken.balanceOf(testDyDxSoloMargin.address)
    var BalWETH = await token.balanceOf(testDyDxSoloMargin.address)
    //var Bal = await toToken.balanceOf(accounts[0])
    //var BalWETH = await token.balanceOf(accounts[0])
    console.log('AFTER')
    console.log('WETH:', BalWETH.toString())
    console.log('USDC:', Bal.toString())
    ETHBal = await web3.eth.getBalance(accounts[0])
    console.log("ETHBAL2:", ETHBal)
    ETHBal = await web3.eth.getBalance(testDyDxSoloMargin.address)
    console.log("ETHBAL2:", ETHBal)
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