const rps = artifacts.require("rps");
const truffleAssert = require("truffle-assertions");
const { toBN } = web3.utils;
const { time } = require("@openzeppelin/test-helpers");

const secret = web3.utils.randomHex(32);
const choice = 1;
const value = web3.utils.toWei("0.01", "ether");

let rpsInstance;
let accountA;
let accountB;
let hashPlayerA;
let hashPlayerB;


contract("Game logic tests", (accounts) => {
  beforeEach(async () => {
    rpsInstance = await rps.new();
    accountA = accounts[0];
    accountB = accounts[1];  

    hashPlayerA = web3.utils.keccak256(web3.utils.encodePacked(
        { value: accountA, type: "address" },
        { value: choice, type: "uint8" },
        {
            value: secret,
            type: "bytes32",
        }
    ));
    hashPlayerB = web3.utils.keccak256(web3.utils.encodePacked(
        { value: accountB, type: "address" },
        { value: choice, type: "uint8" },
        {
            value: secret,
            type: "bytes32",
        }
    ));
  });

  it("Should not be possible to call timeout when players haven't committed", async () => {
    await time.increase(time.duration.minutes(15));

    await truffleAssert.reverts(rpsInstance.playerATimeout({ from: accountB }), "Both players must have committed");
    await truffleAssert.reverts(rpsInstance.playerBTimeout({ from: accountA }), "Both players must have committed");
  });

  it("PlayerATimeout should pay out to player B and calling it again shouldn't be possible", async () => {
    await commitPlayers();
    await revealPlayerB();

    await time.increase(time.duration.minutes(10));
    
    const beforeBalance = toBN(await web3.eth.getBalance(accountB));
    const txReceipt = await rpsInstance.playerATimeout({from: accountB});
    const afterBalance = toBN(await web3.eth.getBalance(accountB));
    const balanceIncrease = await getBalanceIncrease(beforeBalance, afterBalance, txReceipt);

    assert.equal(0.02, balanceIncrease);
    
    await truffleAssert.reverts(rpsInstance.playerATimeout({from: accountA}))
  });

  it("PlayerBTimeout should pay out to player A and calling it again shouldn't be possible", async () => {
    await commitPlayers();
    await revealPlayerA()

    await time.increase(time.duration.minutes(10));
    
    const beforeBalance = toBN(await web3.eth.getBalance(accountA));
    const txReceipt = await rpsInstance.playerBTimeout({from: accountA});
    const afterBalance = toBN(await web3.eth.getBalance(accountA));
    const balanceIncrease = await getBalanceIncrease(beforeBalance, afterBalance, txReceipt);

    assert.equal(0.02, balanceIncrease);

    await truffleAssert.reverts(rpsInstance.playerBTimeout({from: accountA}))
  });

  it("Should not be possible to call timeout after both players have revealed", async () => {
    await commitPlayers();
    await revealPlayerA()
    await revealPlayerB()

    await time.increase(time.duration.minutes(15));

    await truffleAssert.reverts(rpsInstance.playerATimeout({from: accountB}))
    await truffleAssert.reverts(rpsInstance.playerBTimeout({from: accountA}))
  });

  it("Should not be possible to call PlayerATimeout before the timeout period has passed", async () => {
    await commitPlayers();
    await revealPlayerB();

    await time.increase(await time.duration.minutes(9));

    await truffleAssert.reverts(rpsInstance.playerATimeout({from: accountB}));
  })

  it("Should not be possible to call PlayerBTimeout before the timeout period has passed", async () => {
    await commitPlayers();
    await revealPlayerA()

    await time.increase(await time.duration.minutes(9));

    await truffleAssert.reverts(rpsInstance.playerBTimeout({from: accountA}));
  })
})

const commitPlayers = async () => {
    await rpsInstance.commit(hashPlayerA, {from: accountA, value });
    await rpsInstance.commit(hashPlayerB, {from: accountB, value });
}

const revealPlayerA = async () => {
    await rpsInstance.reveal(choice, secret, { from: accountA});

}
const revealPlayerB = async () => {
    await rpsInstance.reveal(choice, secret, { from: accountB});
}

const getBalanceIncrease = async (beforeBalance, afterBalance, txReceipt) => {
    const gasUsed = toBN(txReceipt.receipt.gasUsed);
    const tx = await web3.eth.getTransaction(txReceipt.tx);
    const gasPrice = toBN(tx.gasPrice);
    const gasTotal = gasPrice.mul(gasUsed);
    const balanceIncreaseInWei = afterBalance.add(gasTotal).sub(beforeBalance);
    
    return await web3.utils.fromWei(balanceIncreaseInWei.toString());
}
