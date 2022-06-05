const rps = artifacts.require("rps");
const { toBN } = web3.utils;

let rpsInstance;
let accountA;
let accountB;
let secret = web3.utils.randomHex(32);

contract("Game logic tests", (accounts) => {
  beforeEach(async () => {
    rpsInstance = await rps.new();
    accountA = accounts[0];
    accountB = accounts[1];
  });

  /**
   * Moves
   *
   * Rock:     1
   * Paper:    2
   * Scissors: 3
   */

  /**
   * Results
   *
   * WinnerA: 1
   * WinnerB: 2
   * Draw:    3
   */
  it("Player A: Rock beats Player B: Scissors", async () => {
    const playerAChoice = 1;
    const playerBChoice = 3;
    await commitAndReveal(playerAChoice, playerBChoice);
    await rpsInstance.calculateWinner();
    const result = Number(await rpsInstance.result());
    assert.equal(1, result);
  });

  it("Player B: Rock beats Player A: Scissors", async () => {
    const playerAChoice = 3;
    const playerBChoice = 1;
    await commitAndReveal(playerAChoice, playerBChoice);
    await rpsInstance.calculateWinner();
    const result = Number(await rpsInstance.result());
    assert.equal(2, result);
  });

  it("Player A: Paper beats Player B: Rock", async () => {
    const playerAChoice = 2;
    const playerBChoice = 1;
    await commitAndReveal(playerAChoice, playerBChoice);
    await rpsInstance.calculateWinner();
    const result = Number(await rpsInstance.result());
    assert.equal(1, result);
  });

  it("Player B: Paper beats Player A: Rock", async () => {
    const playerAChoice = 1;
    const playerBChoice = 2;
    await commitAndReveal(playerAChoice, playerBChoice);
    await rpsInstance.calculateWinner();
    const result = Number(await rpsInstance.result());
    assert.equal(2, result);
  });

  it("Player A: Scissors beats Player B: Paper", async () => {
    const playerAChoice = 3;
    const playerBChoice = 2;
    await commitAndReveal(playerAChoice, playerBChoice);
    await rpsInstance.calculateWinner();
    const result = Number(await rpsInstance.result());
    assert.equal(1, result);
  });

  it("Player B: Scissors beats Player A: Paper", async () => {
    const playerAChoice = 2;
    const playerBChoice = 3;
    await commitAndReveal(playerAChoice, playerBChoice);
    await rpsInstance.calculateWinner();
    const result = Number(await rpsInstance.result());
    assert.equal(2, result);
  });

  it("Player A: Rock, Player B: Rock is a draw", async () => {
    const playerAChoice = 1;
    const playerBChoice = 1;
    await commitAndReveal(playerAChoice, playerBChoice);
    await rpsInstance.calculateWinner();
    const result = Number(await rpsInstance.result());
    assert.equal(3, result);
  });

  it("Player A: Paper, Player B: Paper is a draw", async () => {
    const playerAChoice = 2;
    const playerBChoice = 2;
    await commitAndReveal(playerAChoice, playerBChoice);
    await rpsInstance.calculateWinner();
    const result = Number(await rpsInstance.result());
    assert.equal(3, result);
  });

  it("Player A: Scissors, Player B: Scissors is a draw", async () => {
    const playerAChoice = 3;
    const playerBChoice = 3;
    await commitAndReveal(playerAChoice, playerBChoice);
    await rpsInstance.calculateWinner();
    const result = Number(await rpsInstance.result());
    assert.equal(3, result);
  });

  it("Players should be able to withdraw after a draw and balances should be increased correct amount", async () => {
    const playerAChoice = 3;
    const playerBChoice = 3;
    await commitAndReveal(playerAChoice, playerBChoice);
    await rpsInstance.calculateWinner();

    const beforeBalanceA = toBN(await web3.eth.getBalance(accountA));
    const receiptA = await rpsInstance.withdrawPlayerA({ from: accountA });
    const afterBalanceA = toBN(await web3.eth.getBalance(accountA));
    const gasUsedA = toBN(receiptA.receipt.gasUsed);
    const txA = await web3.eth.getTransaction(receiptA.tx);
    const gasPriceA = toBN(txA.gasPrice);
    const gasTotalA = gasPriceA.mul(gasUsedA);
    const balanceIncreaseWeiA = afterBalanceA
      .add(gasTotalA)
      .sub(beforeBalanceA);
    const balanceIncreaseA = web3.utils.fromWei(balanceIncreaseWeiA.toString());

    const beforeBalanceB = toBN(await web3.eth.getBalance(accountB));
    const receiptB = await rpsInstance.withdrawPlayerB({ from: accountB });
    const afterBalanceB = toBN(await web3.eth.getBalance(accountB));
    const gasUsedB = toBN(receiptB.receipt.gasUsed);
    const txB = await web3.eth.getTransaction(receiptB.tx);
    const gasPriceB = toBN(txB.gasPrice);
    const gasTotalB = gasPriceB.mul(gasUsedB);
    const balanceIncreaseWeiB = afterBalanceB
      .add(gasTotalB)
      .sub(beforeBalanceB);
    const balanceIncreaseB = web3.utils.fromWei(balanceIncreaseWeiB.toString());

    assert.equal(0.01, balanceIncreaseA);
    assert.equal(0.01, balanceIncreaseB);
  });
});

const commitAndReveal = async (playerAChoice, playerBChoice) => {
  const hashA = getHash(playerAChoice, accountA);
  const hashB = getHash(playerBChoice, accountB);

  await commit(hashA, accountA);
  await commit(hashB, accountB);
  await reveal(playerAChoice, accountA);
  await reveal(playerBChoice, accountB);
};

const getHash = (choice, accountAddr) => {
  const values = web3.utils.encodePacked(
    { value: accountAddr, type: "address" },
    { value: choice, type: "uint8" },
    {
      value: secret,
      type: "bytes32",
    }
  );
  return web3.utils.keccak256(values);
};

const commit = async (hash, account) => {
  await rpsInstance.commit(hash, {
    from: account,
    value: web3.utils.toWei("0.01", "ether"),
  });
};

const reveal = async (choice, account) => {
  await rpsInstance.reveal(choice, secret, { from: account });
};
