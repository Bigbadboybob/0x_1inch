require('dotenv').config()
require('console.table')
const fs = require('fs')
//const express = require('express')
//const path = require('path')
const http = require('http')
//const cors = require('cors')
const Web3 = require('web3')
//const axios = require('axios')
const moment = require('moment-timezone')
const zrx = require('./zrx')
const inch = require('./1inch')
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

const HDWalletProvider = require("@truffle/hdwallet-provider")
const mnemonic = require("../secrets.json").mnemonic;
const provider = new HDWalletProvider(mnemonic, process.env.RPC_URL)
//const web3 = new Web3(provider)
const web3 = new Web3(process.env.RPC_URL)
const ganache = require("ganache-core")
let accounts = ['0x2E076fB19B3Ee8F55480E0654eD573DadF8cb16d']

const config = require('./config')

const DAI = config.DAI
const WETH = config.WETH
const USDC = config.USDC
const SAI = config.SAI
const USDT = config.USDT
const WBTC = config.WBTC
const LINK = config.LINK
const MKR = config.MKR
const CRV = config.CRV
const MANA = config.MANA
const UNI = config.UNI
const ZRX = config.ZRX
const COMP = config.COMP
const AAVE = config.AAVE

const prices = config.prices
const names = config.names
const tokenDecimals = config.tokenDecimals
const zeroAddress = config.zeroAddress

const ZRX_EXCHANGE_ADDRESS = config.ZRX_EXCHANGE_ADDRESS
const ZRX_EXCHANGE_ABI = config.ZRX_EXCHANGE_ABI
const zrxExchangeContract = new web3.eth.Contract(ZRX_EXCHANGE_ABI, ZRX_EXCHANGE_ADDRESS)
const FILL_ORDER_ABI = config.FILL_ORDER_ABI

const ARBITRAGE_ABI = config.ARBITRAGE_ABI
const ARBITRAGE_ADDRESS = config.ARBITRAGE_ADDRESS
const DyDxSoloMargin = new web3.eth.Contract(ARBITRAGE_ABI, ARBITRAGE_ADDRESS)

const ERC20_ABI = config.ERC20_ABI

const now = () => (moment().tz('America/New_York').format())


function httpGetAsync(theUrl) {
    return new Promise((resolve, reject) => {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() { 
            if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
                resolve(xmlHttp.responseText);
            }
        }
        xmlHttp.open("GET", theUrl, true); // true for asynchronous 
        xmlHttp.send(null);
    })
}

function getGas() {
    return httpGetAsync('https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=VTR3NRFFMAN3YUUW4XJ9B8TUB3XRZ6XDPK')
}

//For now returns profit per starting token and fees in wei
//Later change to return max extractable profit, starting amount and pools
function checkArb(takerToken, makerToken, gasPrice) {
    return new Promise(async (resolve, reject) => {
        //Use quote instead for 0x?
        sorted = await zrx.getSorted(takerToken, makerToken).then( async (sorted) => {
            if (sorted.length < 1) {
                reject("No orders available right now" +names[takerToken]+names[makerToken]);
            }
            let best = sorted[0]
            let zrxOrder = best['order']
            let zrxMeta = best['metaData']
            let remaining = zrxMeta['remainingFillableTakerAssetAmount']
            remaining = web3.utils.toBN(String(remaining)).add(web3.utils.toBN(String(zrxOrder.takerFee)))
            let hundred = web3.utils.toBN(String(10**(tokenDecimals[takerToken] + 2)))
            if (remaining.muln(prices[takerToken]).lt(hundred)) {
                reject('Remaining fillable less than 0.01')
            }
            //calculate makerToken to eth in order to subtract gas at the end

            let takerAmount1 = remaining
            //console.log('Takeramount'+takerToken+':', takerAmount1*prices[takerToken]/(10**tokenDecimals[takerToken]))
            let makerAmount1 = takerAmount1.mul(web3.utils.toBN(zrxOrder['makerAssetAmount'])).div(web3.utils.toBN(zrxOrder['takerAssetAmount']).add(web3.utils.toBN(zrxOrder['takerFee'])))

            //TODO: change address to contract
            let inchQuote = await inch.getSwap(makerToken, takerToken, makerAmount1, config.ARBITRAGE_ADDRESS)
            //TODO: maybe use etherGasStation
            let gas = web3.utils.toBN(String(inchQuote['tx']['gasPrice'])) //in wei
            //let gas = web3.utils.toWei(String(gasPrice), "gwei") //in wei
            if (isNaN(gas) || gas == 0) {
                gas = web3.utils.toBN(process.env.GAS_PRICE.toString())
            }
            let fees = gas.mul(web3.utils.toBN(process.env.ESTIMATED_GAS.toString()))
            let takerAmount2 = inchQuote['toTokenAmount'] //string
            //fees = fees.add(gas.muln(1000000)) //gas Limit
            fees = fees.muln(prices[WETH]) // rough estimate of dollars(18 decimal)/wei
            let dollarFees = fees
            fees = fees.div(web3.utils.toBN(String(10**(18-tokenDecimals[takerToken])))) //taker token decimals but still dollars
            fees = fees.divn(prices[takerToken])
            //slippage

            //TODO: change slippage back to 995
            let takerAmount2Slip = web3.utils.toBN(String(takerAmount2)).muln(995).divn(1000)
            let profit = false;
            //console.log(names[takerToken]+'->'+names[makerToken]+'->'+names[takerToken])
            //TODO: don't go for profit over 1.1 times
            let expectedReturn = takerAmount2Slip.sub(fees).muln(1000000).div(takerAmount1)
            let expectedProfit = expectedReturn.mul(takerAmount1).sub(takerAmount1.muln(1000000)).div(web3.utils.toBN(String(10**tokenDecimals[takerToken])))
            if (takerAmount2Slip.sub(fees).gt(takerAmount1)) {
                console.log('PROFIT: Takeramount'+names[takerToken]+names[makerToken]+':', takerAmount1.muln(prices[takerToken]).div(web3.utils.toBN(String(10**tokenDecimals[takerToken]))).toString())
                console.log(expectedReturn.toNumber()/1000000)
                profit = true;
                console.log(Date.now()/1000)
                var timeDiff = zrxOrder.expirationTimeSeconds - Math.round(Date.now()/1000)
                //TODO: change expiration
                if (timeDiff <= 0){
                    console.log('--------')
                    console.log('EXPIRED')
                    console.log('--------')
                    console.log(zrxOrder.expirationTimeSeconds)
                } else {
                    //clearInterval(mainInterval)
                    console.log(zrxOrder)
                    //console.log(inchQuote)
                    let outLog = names[takerToken] + '->' + names[makerToken] + '->' + names[takerToken]
                    console.log(outLog)
                    console.log([takerAmount2/takerAmount1,
                    expectedReturn.toNumber()/1000000,
                    expectedProfit.toNumber()/1000000,
                    web3.utils.fromWei(dollarFees.toString(), "ether"),
                    profit
                    ])
                    console.log('EXECUTING TRADE!!')
                    //arbInterval = false
                    let receipt = await executeTrade(takerToken, makerToken, takerAmount1, zrxOrder, inchQuote, takerAmount2Slip.toString(), gas,
                        timeDiff, expectedReturn.toNumber()/1000000, expectedProfit.toNumber()/1000000) 
                    /*
                    if (!arbInterval) {
                        arbInterval = true
                    }
                    */
                    console.log(receipt)
                }
            }
            let outLog = names[takerToken] + '->' + names[makerToken] + '->' + names[takerToken]
            console.log(outLog)
            resolve([takerAmount2/takerAmount1,
                expectedReturn.toNumber()/1000000,
                expectedProfit.toNumber()/1000000,
                web3.utils.fromWei(dollarFees.toString(), "ether"),
                profit
            ])
        }).catch( err => {
            reject(err)
        })
    })
}

var trades = []
async function executeTrade(takerToken, makerToken, takerAmount1, zrxOrder, inchSwap, takerAmount2Slip, gPrice, timeDiff, expectedReturn, expectedProfit) {
    //https://github.com/0xProject/0x-protocol-specification/blob/master/v3/v3-specification.md#order-message-format
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

    web3.setProvider(ganache.provider({
        "fork": 'https://speedy-nodes-nyc.moralis.io/676a6c6eac64d9f866c4daca/eth/mainnet',
        "locked": false,
        "mnemonic": mnemonic,
        "unlocked_accounts": ['0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE', '0xF977814e90dA44bFA03b6295A0616a897441aceC',
        '0x66c57bF505A85A74609D2C83E94Aabb26d691E1F', '0x2E076fB19B3Ee8F55480E0654eD573DadF8cb16d'],
    }))
    web3.eth.getAccounts((err, res) => accounts = res)

    //TODO: get fill order abi
    const data = web3.eth.abi.encodeFunctionCall(FILL_ORDER_ABI, [orderTuple, takerAmount1, signature])
    const inchData = inchSwap.tx.data

    //TODO: deploy smart contract and initialize and export in config
    //TODO: change to send()
    
    let execute = false
    console.log('transaction:', transaction)
    if (!transaction) {
        transaction = true
        console.log('testing using estimateGas...')
        await DyDxSoloMargin.methods.initiateFlashLoan(takerToken, takerAmount1, makerToken, data, inchData).estimateGas({
            from: accounts[0], value: gPrice.mul(new web3.utils.toBN(String(140000))), gas: 2000000, gasPrice: gPrice
            }).then((res) => {
                console.log(res)
                execute = true
            }).catch((err, res) => {
                console.log('catch')
                console.log('RESULT:', res)
                console.log('ERROR:', err)
            })

        if (execute) {
            console.log('EXECUTING')
            const tx = await DyDxSoloMargin.methods.initiateFlashLoan(takerToken, takerAmount1, makerToken, data, inchData).send({
                from: accounts[0], value: gPrice.mul(new web3.utils.toBN(String(140000))), gas: 2000000, gasPrice: gPrice
                }).then((err, res) => {
                    console.log('then')
                    console.log('RESULT:', res)
                    console.log('ERROR:', err)
                }).catch((err, res) => {
                    console.log('catch')
                    console.log('RESULT:', res)
                    console.log('ERROR:', err)
                })
            
            const takerContract = new web3.eth.Contract(ERC20_ABI, takerToken)
            bal = await takerContract.methods.balanceOf(ARBITRAGE_ADDRESS).call()
            console.log('Balance:', bal)
            var trade
            if (bal > 0) {
                trade = [true, bal, expectedProfit, timeDiff, names[takerToken], names[makerToken], expectedReturn]
            } else {
                trade = [false, bal, expectedProfit, timeDiff, names[takerToken], names[makerToken], expectedReturn]
            }
            trades.push(trade)
            transaction = false
            clearInterval(mainInterval)
            return 'EXECUTED'
        } else {
            transaction = false
            return 'NOT EXECUTED'
        }
    }
}


let gasPrice = 200 //high start just before init

/*
checkArb(LINK, WETH, gasPrice).then(res => {
    console.log(res)
}).catch(error => {
    console.log(error)
})

checkArb(WBTC, WETH, gasPrice).then(res => {
    console.log('WBTC->WETH->WBTC')
    console.log(res)
    if (res[4]) {
        console.log("PROFIT")
    }
})
*/


let profits = {
    DAIWETH: 0,
    WETHDAI: 0,
    USDCWETH: 0,
    WETHUSDC: 0,
    WETHWBTC: 0,
    WETHLINK: 0,
    USDCWBTC: 0,
    DAIUSDC: 0,
    DAIUSDT: 0,
    USDCDAI: 0
}
let time = 0;

let updateGas = true
setInterval( () => {
    updateGas = true
}, 20000)

let gasJSON
async function call() {
    if (updateGas) {
        gasJSON = await getGas()
        gasPrice = JSON.parse(gasJSON)['result']['ProposeGasPrice'] * 2 //need really FAST transaction?
        console.log('GAS PRICE', gasPrice)
        updateGas = false
        console.log('GAS UPDATE')
    }
    checkArb(DAI, WETH, gasPrice).then(res => {
        console.log(res)
        if (res) {
            return true
        } else {
            call()
        }
    }).catch(error => {
        console.log('DAI->WETH->DAI')
        console.log(error)
    })
}


const arbChecks = async () => {
    /*
    if (updateGas) {
        gasJSON = await getGas()
        gasPrice = JSON.parse(gasJSON)['result']['ProposeGasPrice'] * 2 //need really FAST transaction?
        updateGas = false
    }
    */
    if (arbInterval) {
        checkArb(DAI, WETH, gasPrice).then(res => {
            console.log(res)
            if (res[4]) {
                profits['DAIWETH']++
            }
        }).catch(error => {
            console.log(error)
        })
        
        checkArb(WETH, DAI, gasPrice).then(res => {
            console.log(res)
            if (res[4]) {
                profits['WETHDAI']++
            }
        }).catch(error => {
            console.log(error)
        })
        checkArb(WETH, USDC, gasPrice).then(res => {
            console.log(res)
            if (res[4]) {
                profits['WETHUSDC']++
            }
        }).catch(error => {
            console.log(error)
        })
        checkArb(USDC, WETH, gasPrice).then(res => {
            console.log(res)
            if (res[4]) {
                profits['USDCWETH']++
            }
        }).catch(error => {
            console.log(error)
        })
        checkArb(WETH, WBTC, gasPrice).then(res => {
            console.log(res)
            if (res[4]) {
                profits['WETHWBTC']++
            }
        }).catch(error => {
            console.log(error)
        })
        checkArb(WETH, LINK, gasPrice).then(res => {
            console.log(res)
            if (res[4]) {
                profits['WETHLINK']++
            }
        }).catch(error => {
            console.log(error)
        })
        /*
        checkArb(USDC, WBTC, gasPrice).then(res => {
            console.log(res)
            if (res[4]) {
                profits['USDCWBTC']++
            }
        }).catch(error => {
            console.log(error)
        })
        checkArb(DAI, USDC, gasPrice).then(res => {
            console.log(res)
            if (res[4]) {
                profits['DAIUSDC']++
            }
        }).catch(error => {
            console.log(error)
        })
        checkArb(USDC, DAI, gasPrice).then(res => {
            console.log(res)
            if (res[4]) {
                profits['USDCDAI']++
            }
        }).catch(error => {
            console.log(error)
        })
        */
        
        time++
        if (time >= 200) {
            console.log(profits)
            console.log(trades)
            fs.writeFile('src/logs/profits.txt', JSON.stringify(profits), err => console.log(err))
            fs.writeFile('src/logs/trades.txt', '', err => {
                if (err != null) {
                    console.log(err)
                }
            })
            for (var i = 0; i < trades.length; i++) {
                var trade = trades[i]
                fs.appendFile('src/logs/trades.txt', JSON.stringify(trade) + '\n', err => {
                    if (err != null) {
                        console.log(err)
                    }
                })
            }
            console.log(transaction)
            time = 0
        }
    }
}

var mainInterval = setInterval(arbChecks, 1000)
var arbInterval = true
var transaction = false



//bytes memory data = abi.encode(flashToken, flashAmount, balanceBefore, arbToken, zrxData, oneSplitMinReturn, oneSplitDistribution);