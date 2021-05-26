const Web3 = require("web3");
const provider = new Web3.providers.HttpProvider("https://bsc-dataseed.binance.org/");
const Contract = require('web3-eth-contract');
const telegramListener = require('./telegram/telegram-listener');
Contract.setProvider(provider);
const web3 = new Web3(provider);
const secret = require('./secret');
const { sleep } = require('@mtproto/core/src/utils/common');

//--- Change if needed
const gas = 2000000;
const gasPrice = Web3.utils.toWei("10", "shannon")
//---

const max = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
const pancakeSwapAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const wBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const pancakeswapRouterContract = new Contract(require('./pancakeswap-router-abi'), pancakeSwapAddress);

const swapBNBToShitToken = async (shitTokenAddress, bnbAmountToBuy) => {

    const data = pancakeswapRouterContract.methods.swapExactETHForTokens(
        1, // Min amount. 1 means 100% slippage
        [
            wBNB,
            shitTokenAddress // The address of the shitoken
        ],
        secret.public_key, // Your address
        new Date().getTime() + (60 * 1000) // 1 hour from now
    ).encodeABI();

    const tx = signTransaction(secret.public_key, pancakeSwapAddress, Web3.utils.toWei(bnbAmountToBuy, "ether"), data);

    await signAndTransmitTransaction(tx, 'swapBNBToShitToken');

};

const swapShitTokenToBNB = async (withFee, shitTokenAddress) => {

    const shitTokenContract = new Contract(require('./shit-token-abi'), shitTokenAddress);

    const amountOfShitToken = await shitTokenContract.methods.balanceOf(secret.public_key).call();

    console.log("blanace of", amountOfShitToken);

    const data = pancakeswapRouterContract.methods[withFee ? 'swapExactTokensForETHSupportingFeeOnTransferTokens' : 'swapExactTokensForETH'](
        amountOfShitToken,
        1, // Min amount. 1 means 100% slippage
        [
            shitTokenAddress,
            wBNB, // WBNB
        ],
        secret.public_key, // Your address
        new Date().getTime() + (60 * 1000) // 1 hour from now
    ).encodeABI();

    const tx = signTransaction(secret.public_key, pancakeSwapAddress, 0, data);

    await signAndTransmitTransaction(tx, 'swapShitTokenToBNB');

};

const approveShitToken = async (shitTokenAddress) => {

    const shitTokenContract = new Contract(require('./shit-token-abi'), shitTokenAddress);

    const data = shitTokenContract.methods.approve(
        pancakeSwapAddress,
        max // Infinite
    ).encodeABI();

    const tx = signTransaction(secret.public_key, shitTokenAddress, 0, data);

    await signAndTransmitTransaction(tx, 'approveShitToken');
};

const signAndTransmitTransaction = async (tx, name) => {

    const signedTransaction = await web3.eth.accounts.signTransaction(
        tx,
        secret.private_key
    );

    await web3.eth.sendSignedTransaction(signedTransaction.rawTransaction).on('transactionHash', function (hash) {
        console.log("transactionHash", hash);
    }).on('receipt', function (receipt) {
        console.log("receipt - ", name);
    }).on('error', console.error); // If a out of gas error, the second parameter is the receipt.;;

};

const signTransaction = (from, to, value, data) => {
    return {
        // this could be provider.addresses[0] if it exists
        from: from,
        // target address, this could be a smart contract address
        to: to,
        // optional if you want to specify the gas limit
        gas: gas,
        gapPrice: gasPrice,
        // optional if you are invoking say a payable function
        value: value,
        // this encodes the ABI of the method and the arguements
        data: data
    };
};

(async () => {

    await telegramListener(
        'Pancakeswap Pumping ©',
        '6 HOURS REMAINING',
        30,
        async (message) => {

            const regex = /outputCurrency=(.*)\s/i;

            if (regex.test(message)) {
                const shitTokenAddress = message.match(regex)[1].trim();

                console.log("Found shittoken", shitTokenAddress);
                await swapBNBToShitToken(shitTokenAddress, "0.001");

                console.log("Waiting 10 seconds");
                await sleep(10 * 1000);

                console.log("Approving shittoken");
                await approveShitToken(shitTokenAddress);
                console.log("Selling shittoken");
                await swapShitTokenToBNB(true, shitTokenAddress);
            }

        }
    );

})();