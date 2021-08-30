const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const Web3 = require('web3')
const web3 = new Web3(process.env.RPC_URL)


const coinDATA = require('./config')

const DAI = coinDATA.DAI
const WETH = coinDATA.WETH
const USDC = coinDATA.USDC
const SAI = coinDATA.SAI
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

function get0x(extension) {
    return httpGetAsync('https://api.0x.org' + extension)
}

//You provide taker token
function getOrders(takerToken, makerToken) {
    return new Promise((resolve, reject) => {
        //TODO: v4
        get0x('/sra/v3/orders?perPage=100&makerAssetData=0xf47261b0000000000000000000000000' + makerToken.substring(2, 42).toLowerCase() + '&takerAssetData=0xf47261b0000000000000000000000000' + takerToken.substring(2, 42).toLowerCase()).then(text => {
            orders = JSON.parse(text)
            resolve(orders);
        }).catch(error => {
            reject(error)
        })
    })
}

//Sorts orders and filters out too small orders
function getSorted(takerToken, makerToken) {
    return new Promise((resolve, reject) => {
        getOrders(takerToken, makerToken).then(orders => {
            records = orders['records']
            if (records.lengths < 1) {
                reject("No orders available right now");
            }
            let price;
            sorted = new Array(records.length)
            let length = 0
            for (i = 0; i < records.length; i++) {
                zrxOrder = records[i]['order']
                zrxMeta = records[i]['metaData']
                //remainingFillableTakerAmount?
                let remaining = zrxMeta['remainingFillableTakerAssetAmount']
                remaining = web3.utils.toBN(String(remaining))
                decimalBN = web3.utils.toBN(String(10**(tokenDecimals[takerToken])))
                let threshHold = web3.utils.toBN(String(2000)).mul(decimalBN) //10^decimals
                // remaining in $10^decimals > 2000*10^decimals
                if (remaining.muln(prices[takerToken]).gt(threshHold)) {
                    price = (parseInt(zrxOrder['takerAssetAmount']) + parseInt(zrxOrder['takerFee']))/zrxOrder['makerAssetAmount']
                    for (p = 0; p < sorted.length; p++) {
                        if (p == length) {
                            sorted[p] = {'price': price, 'order': zrxOrder, 'metaData': zrxMeta}
                            break
                        } else if (sorted[p]['price'] > price) {
                            for(rest = length - 1; rest > p - 1; rest--) {
                                sorted[rest + 1] = sorted[rest]
                            }
                            sorted[p] = {'price': price, 'order': zrxOrder, 'metaData': zrxMeta}
                            break
                        }
                    }
                    length++
                }
            }
            resolve(sorted.slice(0, length))
        })
    })
}


//daiWeth = getOrders(DAI, WETH).then( orders => console.log(orders))
//wethDai = getOrders(WETH, DAI)

const USDG = '0xf906997808f73b09c1007b98ab539b189282b192'
const OWN = '0xcC6F15Be8573cB8243C42d300565566D328213Dd'
/*
getSorted(SAI, OWN).then( orders => {
    console.log(orders.length)
    console.log(orders[0])
})
*/



//These are limit orders meaning potential sells
function getPrices(takerToken, makerToken) {
    return new Promise((resolve, reject) => {
        getOrders(takerToken, makerToken).then(orders => {
            records = orders['records']
            if (records.lengths < 1) {
                reject("No orders available right now");
            }
            prices = new Array(records.length)
            for (i = 0; i < records.length; i++) {
                order = records[i]['order']
                price = (parseInt(order['takerAssetAmount']) + parseInt(order['takerFee']))/order['makerAssetAmount']
                prices[i] = {
                    signature: order['signature'],
                    price: price
                }
            }
            resolve(prices)
        }).catch(error => {
            reject(error)
        })
    })
}

//Returns array with first element as lowest taker/maker ratio
function bestOrder(takerToken, makerToken) {
    return new Promise((resolve, reject) => {
        getOrders(takerToken, makerToken).then(orders => {
            records = orders['records']
            if (records.lengths < 1) {
                reject("No orders available right now");
            }
            let best;
            let bestMeta;
            let lowest = Number.MAX_SAFE_INTEGER
            for (i = 0; i < records.length; i++) {
                order = records[i]['order']
                metaData = records[i]['metaData']
                price = (parseInt(order['takerAssetAmount']) + parseInt(order['takerFee']))/order['makerAssetAmount']
                if (price < lowest) {
                    lowest = price
                    best = order
                    bestMeta = metaData
                }
            }
            resolve({order: best, metaData: bestMeta, price: lowest})
        }).catch(error => {
            reject(error)
        })
    })
}

//getPrices(WETH, DAI).then(prices => console.log(prices))
//getPrices(DAI, WETH).then(prices => console.log(prices))

//bestOrder(DAI, WETH).then(prices => console.log(prices))
//for comparison
//get0x('/swap/v1/quote?sellToken=DAI&buyToken=WETH&buyAmount=1').then(prices => console.log(JSON.parse(prices)))

//get0x('/swap/v1/prices?sellToken=DAI').then(prices => console.log(prices))
//get0x('/swap/v1/prices?sellToken=WETH').then(prices => console.log(prices))

//getSorted(DAI, WETH).then(res => console.log(res))

module.exports = {
    getPrices,
    getOrders,
    bestOrder,
    getSorted
}