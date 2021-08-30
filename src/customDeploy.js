require('dotenv').config()
const AlchemyWeb3 = require('@alch/alchemy-web3')
const RPC_URL = 'https://ropsten.infura.io/v3/d784ba1b7b8a4f13942f0a8aaf68596d'
const web3 = new Web3(RPC_URL)
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var request = new XMLHttpRequest();
request.open('GET', '../build/contracts/DyDxSoloMargin.json', false)
request.send(null)
var jsonObject = JSON.parse(request.responseText)


const contractBytecode = jsonObject.byteCode
const contractABI = jsonObject.abi
console.log(contractBytecode)
console.log(contractABI)