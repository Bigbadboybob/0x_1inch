// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import { FlashLoanReceiverBase } from "./FlashLoanReceiverBase.sol";
import { ILendingPool, ILendingPoolAddressesProvider, IERC20 } from "./Interfaces.sol";
import { SafeMath } from "./Libraries.sol";

/** 
    !!!
    Never keep funds permanently on your FlashLoanReceiverBase contract as they could be 
    exposed to a 'griefing' attack, where the stored funds are used by an attacker.
    !!!
 */
contract MyV2FlashLoan is FlashLoanReceiverBase {
    using SafeMath for uint256;

    event Log(string message, uint val);
    event Log(string message, bytes val);

    address payable OWNER;

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == OWNER, "caller is not the owner!");
        _;
    }

    //TODO:Find address provider and see how to deploy contract with constructor
    constructor(address _addressProvider) FlashLoanReceiverBase(_addressProvider) public {
        //emit Log('constructor', 8);
        OWNER = payable(msg.sender);
    }

    // OneSplit Config
    address INCH_ROUTER_ADDRESS = 0x11111112542D85B3EF69AE05771c2dCCff4fAa26;

    // ZRX Config
    address ZRX_EXCHANGE_ADDRESS = 0x61935CbDd02287B511119DDb11Aeb42F1593b7Ef;
    address ZRX_ERC20_PROXY_ADDRESS = 0x95E6F48254609A6ee006F7D493c8e5fB97094ceF;
    address ZRX_STAKING_PROXY = 0xa26e80e7Dea86279c6d778D702Cc413E6CFfA777; // Fee collector

    function myFlashLoanCall(address flashToken, uint256 flashAmount, address arbToken,
    bytes calldata zrxData, bytes calldata inchData) external payable {
        address receiverAddress = address(this);

        address[] memory assets = new address[](1);
        assets[0] = flashToken;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = flashAmount;

        // 0 = no debt, 1 = stable, 2 = variable
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;

        uint256 balanceBefore = IERC20(flashToken).balanceOf(address(this));
        bytes memory params = abi.encode(balanceBefore, arbToken, zrxData, inchData);

        address onBehalfOf = address(this);
        uint16 referralCode = 0;

        LENDING_POOL.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            params,
            referralCode
        );
    }

    /**
        This function is called after your contract has received the flash loaned amount
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    )
        external
        override
        returns (bool)
    {
        (uint256 balanceBefore, address arbToken, 
        bytes memory zrxData, bytes memory inchData) = abi.decode(params, (uint256, address, bytes, bytes));
        //address flashToken = assets[0];
        //uint256 amounts[0] = amounts[0];
        _repay(assets, amounts, premiums, arbToken, balanceBefore, zrxData, inchData);


        return true;
    }

    function _repay (address[] memory _assets, uint256[] memory _amounts, uint256[] memory _premiums,
    address _arbToken, uint256 balanceBefore, bytes memory _zrxData, bytes memory _inchData)
    internal returns(uint256){
        uint256 balanceAfter = IERC20(_assets[0]).balanceOf(address(this));
        require(balanceAfter - balanceBefore == _amounts[0], "contract did not get the loan");
        emit Log("Balance After:", balanceAfter);

        //Perform arbitrage
        _trade(_assets[0], _arbToken, _amounts[0], _zrxData, _inchData);

        // Approve the LendingPool contract allowance to *pull* the owed amount
        uint256 _endBalance = IERC20(_assets[0]).balanceOf(address(this));

        uint256 amountOwing = _amounts[0].add(_premiums[0]);
        IERC20(_assets[0]).approve(address(LENDING_POOL), amountOwing);

        emit Log("endBal", _endBalance);
        emit Log("startBal", balanceAfter);
        emit Log("repay", amountOwing);
        emit Log("bal - repay", _endBalance - amountOwing);
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
