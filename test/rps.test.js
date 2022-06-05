const rps = artifacts.require("rps");
const truffleAssert = require("truffle-assertions");
const { toBN } = web3.utils;

contract("Contract tests", (accounts) => {
  let rpsInstance;

  let playerASecret;
  let playerBSecret;

  const accountA = accounts[0];
  const accountB = accounts[1];
  const accountC = accounts[2];
  const testHash = web3.utils.keccak256("test");

  beforeEach(async () => {
    rpsInstance = await rps.deployed();
  });

  it("Player should not be able to commit when insufficient amount is sent", async () => {
    await truffleAssert.reverts(
      rpsInstance.commit(testHash, {
        from: accountA,
        value: web3.utils.toWei("0.009", "ether"),
      }),
      "Insufficient amount sent"
    );
  });

  it("Player A should be able to commit", async () => {
    playerASecret = web3.utils.randomHex(32);

    const values = web3.utils.encodePacked(
      { value: accountA, type: "address" },
      { value: 2, type: "uint8" },
      {
        value: playerASecret,
        type: "bytes32",
      }
    );
    const hash = web3.utils.keccak256(values);

    await rpsInstance.commit(hash, {
      from: accountA,
      value: web3.utils.toWei("0.01", "ether"),
    });

    const playerACommitment = await rpsInstance.playerACommitment();
    const playerA = await rpsInstance.playerA();
    assert.equal(hash, playerACommitment);
    assert.equal(playerA, accountA);
  });

  it("Player A should not be able to commit twice", async () => {
    await truffleAssert.reverts(
      rpsInstance.commit(testHash, {
        from: accountA,
        value: web3.utils.toWei("0.01", "ether"),
      }),
      "You have already joined"
    );
  });

  it("Player B should be able to commit", async () => {
    playerBSecret = web3.utils.randomHex(32);

    const values = web3.utils.encodePacked(
      { value: accountB, type: "address" },
      { value: 3, type: "uint8" },
      { value: playerBSecret, type: "bytes32" }
    );
    const hash = web3.utils.keccak256(values);

    await rpsInstance.commit(hash, {
      from: accountB,
      value: web3.utils.toWei("0.01", "ether"),
    });

    const playerBCommitment = await rpsInstance.playerBCommitment();
    const playerB = await rpsInstance.playerB();
    assert.equal(hash, playerBCommitment);
    assert.equal(playerB, accountB);
  });

  it("Player B should not be able to commit twice", async () => {
    await truffleAssert.reverts(
      rpsInstance.commit(testHash, {
        from: accountB,
        value: web3.utils.toWei("0.01", "ether"),
      }),
      "Game is full"
    );
  });

  it("Third player should not be able to commit", async () => {
    await truffleAssert.reverts(
      rpsInstance.commit(testHash, {
        from: accountC,
        value: web3.utils.toWei("0.01", "ether"),
      }),
      "Game is full"
    );
  });

  it("Revealing should revert with invalid move", async () => {
    await truffleAssert.reverts(
      rpsInstance.reveal(0, playerASecret, { from: accountA }),
      "Invalid move"
    );
    await truffleAssert.reverts(
      rpsInstance.reveal(4, playerASecret, { from: accountA })
    );
    await truffleAssert.reverts(
      rpsInstance.reveal(5, playerASecret, { from: accountA })
    );
    await truffleAssert.fails(
      rpsInstance.reveal(-1, playerASecret, { from: accountA })
    );
  });

  it("Revealing should revert when sent params are incorrect", async () => {
    await truffleAssert.reverts(
      rpsInstance.reveal(2, testHash, { from: accountA }),
      "Invalid parameters sent"
    );
    await truffleAssert.reverts(
      rpsInstance.reveal(1, playerASecret, { from: accountA }),
      "Invalid parameters sent"
    );
  });

  it("Player A should be able to reveal", async () => {
    assert.equal(0, Number(await rpsInstance.playerAChoice()));

    await rpsInstance.reveal(2, playerASecret, { from: accountA });
    const playerAChoice = await rpsInstance.playerAChoice();

    assert.equal(2, Number(playerAChoice));
  });

  it("withdrawPlayerA should not be callable before winner is calculated", async () => {
    await truffleAssert.reverts(
      rpsInstance.withdrawPlayerA({ from: accountA }),
      "Winner is not declared yet"
    );
    await truffleAssert.reverts(
      rpsInstance.withdrawPlayerA({ from: accountB }),
      "Unauthorized"
    );
    await truffleAssert.reverts(
      rpsInstance.withdrawPlayerA({ from: accountC }),
      "Unauthorized"
    );
  });

  it("withdrawPlayerB should not be callable before winner is calculated", async () => {
    await truffleAssert.reverts(
      rpsInstance.withdrawPlayerB({ from: accountA }),
      "Unauthorized"
    );
    await truffleAssert.reverts(
      rpsInstance.withdrawPlayerB({ from: accountB }),
      "Winner is not declared yet"
    );
    await truffleAssert.reverts(
      rpsInstance.withdrawPlayerB({ from: accountC }),
      "Unauthorized"
    );
  });

  it("Calculate winner should not be callable before both players have revealed", async () => {
    await truffleAssert.reverts(
      rpsInstance.calculateWinner(),
      "Both players must have revealed"
    );
  });

  it("Player B should be able to reveal", async () => {
    assert.equal(0, Number(await rpsInstance.playerBChoice()));
    await rpsInstance.reveal(3, playerBSecret, { from: accountB });
    const playerBChoice = await rpsInstance.playerBChoice();
    assert.equal(3, Number(playerBChoice));
  });

  it("Calculate winner should declare correct winner", async () => {
    await rpsInstance.calculateWinner();
    const winner = Number(await rpsInstance.result());
    assert.equal(2, winner);
  });

  it("Calculate winner should not be callable twice", async () => {
    await truffleAssert.reverts(rpsInstance.calculateWinner());
  });

  it("Loser should not be able to withdraw", async () => {
    await truffleAssert.reverts(
      rpsInstance.withdrawPlayerA({ from: accountA })
    );
  });

  it("Winner should be able to withdraw and balance is increased by bet * 2", async () => {
    const beforeBalance = toBN(await web3.eth.getBalance(accountB));
    const receipt = await rpsInstance.withdrawPlayerB({ from: accountB });
    const afterBalance = toBN(await web3.eth.getBalance(accountB));

    const gasUsed = toBN(receipt.receipt.gasUsed);
    const tx = await web3.eth.getTransaction(receipt.tx);
    const gasPrice = toBN(tx.gasPrice);
    const gasTotal = gasPrice.mul(gasUsed);

    const balanceIncreaseInWei = afterBalance.add(gasTotal).sub(beforeBalance);
    const balanceIncrease = web3.utils.fromWei(balanceIncreaseInWei.toString());

    assert.equal(0.02, balanceIncrease);
  });

  it("Winner should not be able to withdraw twice", async () => {
    await truffleAssert.reverts(
      rpsInstance.withdrawPlayerB({ from: accountB })
    );
  });
});
