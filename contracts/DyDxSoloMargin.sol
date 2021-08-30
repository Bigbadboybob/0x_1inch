// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
pragma experimental ABIEncoderV2;

import "./interfaces/DydxFlashloanBase.sol";
import "./interfaces/ICallee.sol";
import "./interfaces/swapContracts.sol";

contract DyDxSoloMargin is ICallee, DydxFlashloanBase {
    address private constant SOLO = 0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e;

    // JUST FOR TESTING - ITS OKAY TO REMOVE ALL OF THESE VARS
    address public flashUser;


    // Addresses
    address payable OWNER;
    
    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}


    constructor() payable {
        _getWeth(msg.value);
        _approveWeth(msg.value);
        OWNER = payable(msg.sender);
    }

    // OneSplit Config
    address INCH_ROUTER_ADDRESS = 0x11111112542D85B3EF69AE05771c2dCCff4fAa26;

    // ZRX Config
    address ZRX_EXCHANGE_ADDRESS = 0x61935CbDd02287B511119DDb11Aeb42F1593b7Ef;
    address ZRX_ERC20_PROXY_ADDRESS = 0x95E6F48254609A6ee006F7D493c8e5fB97094ceF;
    address ZRX_STAKING_PROXY = 0xa26e80e7Dea86279c6d778D702Cc413E6CFfA777; // Fee collector

    // TOKENS
    address public WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public SAI = 0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359;
    address public USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == OWNER, "caller is not the owner!");
        _;
    }

    event Log(string message, uint val);
    event Log(string message, bytes val);

    struct MyCustomData {
        address token;
        uint repayAmount;
    }

    function initiateFlashLoan(address flashToken, uint256 flashAmount, address arbToken,
    bytes calldata zrxData, bytes calldata inchData) external payable {
        ISoloMargin solo = ISoloMargin(SOLO);

        // Get marketId from token address
        /*
        0	WETH
        1	SAI
        2	USDC
        3	DAI
        */
        uint marketId = _getMarketIdFromTokenAddress(SOLO, flashToken);

        // Calculate repay amount (flashAmount + (2 wei))
        uint repayAmount = _getRepaymentAmountInternal(flashAmount);
        IERC20(flashToken).approve(SOLO, repayAmount);
        
        uint256 balanceBefore = IERC20(flashToken).balanceOf(address(this));
        bytes memory data = abi.encode(flashToken, flashAmount, balanceBefore, repayAmount, arbToken, zrxData, inchData);

        /*
        1. Withdraw
        2. Call callFunction()
        3. Deposit back
        */

        Actions.ActionArgs[] memory operations = new Actions.ActionArgs[](3);

        operations[0] = _getWithdrawAction(marketId, flashAmount);
        operations[1] = _getCallAction(data);
        operations[2] = _getDepositAction(marketId, repayAmount);

        Account.Info[] memory accountInfos = new Account.Info[](1);
        accountInfos[0] = _getAccountInfo();

        solo.operate(accountInfos, operations);
    }

    //event balances(uint256 balanceBefore, uint256 balanceAfter);
    function callFunction(
        address sender,
        Account.Info memory account,
        bytes memory data
    ) public override {
        require(msg.sender == SOLO, "!solo");
        require(sender == address(this), "!this contract");

        (address flashToken, uint256 flashAmount, uint256 balanceBefore, uint256 repayAmount, address arbToken,
        bytes memory zrxData, bytes memory inchData) = abi
            .decode(data, (address, uint256, uint256, uint256, address, bytes, bytes));
        uint256 balanceAfter = IERC20(flashToken).balanceOf(address(this));
        //emit balances(balanceBefore, balanceAfter);
        require(
            balanceAfter - balanceBefore == flashAmount,
            "contract did not get the loan"
        );

        //arbitrage code:
        // Track original balance
        uint256 _startBalance = IERC20(flashToken).balanceOf(address(this));

        // Perform the arb trade
        _trade(flashToken, arbToken, flashAmount, zrxData, inchData);

        // Track result balance
        uint256 _endBalance = IERC20(flashToken).balanceOf(address(this));

        //require(_endBalance > _startBalance, "End balance must exceed start balance.");

        flashUser = sender;
        emit Log("startBal", _startBalance);
        emit Log("endBal", _endBalance);
        emit Log("repay", repayAmount);
        emit Log("bal - repay", _startBalance - repayAmount);
    }

    function trade(address _fromToken, address _toToken, uint256 _fromAmount,
    bytes memory _0xData, bytes memory _1inchData) onlyOwner payable public {
        _trade(_fromToken, _toToken, _fromAmount, _0xData, _1inchData);
    }

    function _trade(address _fromToken, address _toToken, uint256 _fromAmount, bytes memory _0xData, bytes memory _1inchData) internal {
        address _recipient = address(this);
        // Track the balance of the token RECEIVED from the trade
        uint256 _beforeBalance = IERC20(_toToken).balanceOf(_recipient);
        emit Log("beforeBalanceToToken", _beforeBalance);

        // Swap on 0x: give _fromToken, receive _toToken
        _zrxSwap(_fromToken, _fromAmount, _0xData);

        // Calculate the how much of the token we received
        uint256 _afterBalance = IERC20(_toToken).balanceOf(_recipient);

        emit Log("afterBalnaceToToken", _afterBalance);

        // Read _toToken balance after swap
        uint256 _toAmount = _afterBalance - _beforeBalance;

        // Swap on uniswap
        _1inchSwap(_toToken, _toAmount, _1inchData);
    }

    function zrxSwap(address _from, uint256 _amount, bytes memory _callData) onlyOwner public payable {
        _zrxSwap(_from, _amount, _callData);
    }

    function _zrxSwap(address _from, uint256 _amount, bytes memory _callData) internal {
        // Approve tokens
        IERC20 _fromIERC20 = IERC20(_from);
        uint256 _beforeBalance = _fromIERC20.balanceOf(address(this));
        emit Log("beforeBalance", _beforeBalance);
        
        bool approval;
        approval = _fromIERC20.approve(ZRX_ERC20_PROXY_ADDRESS, _amount);
        
        uint app = 2;
        if (approval) {
            app = 1;
        } else {
            app = 0;
        }
        emit Log("approval", app);
        
        bool swapSuccess;
        bytes memory result;
        //gasprice*70000 is protocol fee
        (swapSuccess, result) = address(ZRX_EXCHANGE_ADDRESS).call{value: tx.gasprice*70000, gas: 300000}(_callData);
        
        app = 2;
        if (swapSuccess) {
            app = 1;
        } else {
            app = 0;
        }
        emit Log("success", app);
        emit Log("result", result);

        uint256 _afterBalance = _fromIERC20.balanceOf(address(this));
        emit Log("afterBalance", _afterBalance);

        // Reset approval
        _fromIERC20.approve(ZRX_ERC20_PROXY_ADDRESS, 0);
        
        
    }

    function inchSwap(address _from, uint256 _amount, bytes memory _callData) onlyOwner public payable {
        _1inchSwap(_from, _amount, _callData);
    }

    function _1inchSwap(address _from, uint256 _amount, bytes memory _callData) internal {
        // Approve tokens
        IERC20 _fromIERC20 = IERC20(_from);
        uint256 _beforeBalance = _fromIERC20.balanceOf(address(this));
        emit Log("beforeBalance", _beforeBalance);
        
        bool approval;
        approval = _fromIERC20.approve(INCH_ROUTER_ADDRESS, _amount);
        
        uint app = 2;
        if (approval) {
            app = 1;
        } else {
            app = 0;
        }
        emit Log("approval", app);
        
        bool swapSuccess;
        bytes memory result;
        (swapSuccess, result) = address(INCH_ROUTER_ADDRESS).call{gas: 1000000}(_callData);
        
        app = 2;
        if (swapSuccess) {
            app = 1;
        } else {
            app = 0;
        }
        emit Log("success", app);
        emit Log("result", result);

        uint256 _afterBalance = _fromIERC20.balanceOf(address(this));
        emit Log("afterBalance", _afterBalance);

        // Reset approval
        _fromIERC20.approve(INCH_ROUTER_ADDRESS, 0);
        
        
    }

    function getWeth() public payable onlyOwner {
        _getWeth(msg.value);
    }

    function _getWeth(uint256 _amount) internal {
        (bool success, ) = WETH.call{value: _amount}("");
        require(success, "failed to get weth");
    }

    function approveWeth(uint256 _amount) public onlyOwner {
        _approveWeth(_amount);
    }

    function _approveWeth(uint256 _amount) internal {
        IERC20(WETH).approve(ZRX_STAKING_PROXY, _amount); // approves the 0x staking proxy - the proxy is the fee collector for 0x, i.e. if you want to use weth to pay
    }

    // KEEP THIS FUNCTION IN CASE THE CONTRACT RECEIVES TOKENS!
    function withdrawToken(address _tokenAddress) public onlyOwner {
        uint256 balance = IERC20(_tokenAddress).balanceOf(address(this));
        IERC20(_tokenAddress).transfer(OWNER, balance);
    }

    // KEEP THIS FUNCTION IN CASE THE CONTRACT KEEPS LEFTOVER ETHER!
    function withdrawEther() public onlyOwner {
        address self = address(this); // workaround for a possible solidity bug
        uint256 balance = self.balance;
        OWNER.transfer(balance);
    }

    function setOwner(address payable _newOwner) public onlyOwner {
        OWNER = _newOwner;
    }
}
// Solo margin contract mainnet - 0x1e0447b19bb6ecfdae1e4ae1694b0c3659614e4e
// payable proxy - 0xa8b39829cE2246f89B31C013b8Cde15506Fb9A76

// https://etherscan.io/tx/0xda79adea5cdd8cb069feb43952ea0fc510e4b6df4a270edc8130d8118d19e3f4