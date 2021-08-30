const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
require('dotenv').config()
const Web3 = require('web3')
const web3 = new Web3(process.env.RPC_URL)

const coinDATA = require('./config')

const DAI = coinDATA.DAI
const WETH = coinDATA.WETH
const USDC = coinDATA.USDC
const USDT = coinDATA.USDT
const WBTC = coinDATA.WBTC
const LINK = coinDATA.LINK
const MKR = coinDATA.MKR
const CRV = coinDATA.CRV
const MANA = coinDATA.MANA
const UNI = coinDATA.UNI
const ZRX = coinDATA.ZRX
const COMP = coinDATA.COMP
const AAVE = coinDATA.AAVE

const prices = coinDATA.prices
const names = coinDATA.names
const tokenDecimals = coinDATA.tokenDecimals
const zeroAddress = coinDATA.zeroAddress

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

function get1inch(extension) {
    return httpGetAsync('https://api.1inch.exchange/v3.0/1' + extension)
}

function getQuote(fromToken, toToken, amount = web3.utils.toBN(String(10**18))) {
    return new Promise((resolve, reject) => {
        get1inch('/quote?fromTokenAddress=' + fromToken
        + '&toTokenAddress=' + toToken
        + '&amount=' + amount.toString()).then(text => {
            quote = JSON.parse(text)
            resolve(quote)
        }).catch(error => {
            reject(error)
        })
    })
}

function getSwap(fromToken, toToken, amount = web3.utils.toBN(String(10**18)), address = process.env.ADDRESS) {
    return new Promise((resolve, reject) => {
        get1inch('/swap?disableEstimate=true&gasLimit=1000000&fromTokenAddress=' + fromToken
        + '&toTokenAddress=' + toToken
        + '&amount=' + amount.toString()
        + '&fromAddress=' + address
        + '&slippage=5'
        + '&gasPrice=45000000000'
        + '&gasLimit=1000000'
        + '&mainRouteParts=10'
        + '&parts=10'
        ).then(text => {
            quote = JSON.parse(text)
            resolve(quote)
        }).catch(error => {
            reject(error)
        })
    })
}

/*
getQuote(WETH, DAI, 10**18).then( res => {
    console.log('QUOTE')
    console.log(res['toTokenAmount'])
    console.log(res)
    let route = res['protocols']
    console.log('route')
    console.log(route)
    for (i = 0; i < route.length; i++) {
        console.log(route[i])
    }
})
*/

/*
getSwap(WETH, USDC, 10**20).then( res => {
    console.log('SWAP')
    console.log(res['toTokenAmount'])
    console.log(res.tx.gasPrice*10**(-9))
})
*/



module.exports = {
    getQuote,
    getSwap
}