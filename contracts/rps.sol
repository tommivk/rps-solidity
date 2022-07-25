// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

contract rps {
    enum Move {
        NULL,
        Rock,
        Paper,
        Scissors
    }
    enum Result {
        NULL,
        WinnerA,
        WinnerB,
        Draw
    }
    address payable public playerA;
    address payable public playerB;
    bytes32 public playerACommitment;
    bytes32 public playerBCommitment;
    uint256 constant public bet = 0.01 ether;
    Result public result;
    Move public playerAChoice;
    Move public playerBChoice;
    bool public winnerDeclared = false;
    bool public playerACanWithdraw = false;
    bool public playerBCanWithdraw = false;
    uint256 public playersCommittedTime;
    uint256 constant public timeout = 10 minutes;

    function commit(bytes32 _commitment) public payable {
        require(playerB == address(0), "Game is full");
        require(msg.value >= bet, "Insufficient amount sent");

        if (playerA == address(0)) {
            playerA = payable(msg.sender);
            playerACommitment = _commitment;
        } else {
            require(playerA != msg.sender, "You have already joined");
            playerB = payable(msg.sender);
            playerBCommitment = _commitment;
            playersCommittedTime = block.timestamp;
        }
    }

    function reveal(Move _choice, bytes32 _secret) public {
        require(msg.sender == playerA || msg.sender == playerB, "You're not a player");
        require(playerACommitment != 0 && playerBCommitment != 0, "Both players must have committed");
        require(
            _choice == Move.Rock ||
             _choice == Move.Paper ||
              _choice == Move.Scissors, 
            "Invalid move"
        );

        if (msg.sender == playerA) {
            require(keccak256(abi.encodePacked(msg.sender, _choice, _secret)) == playerACommitment, "Invalid parameters sent");
            playerAChoice = _choice;
        }

        if (msg.sender == playerB) {
            require(keccak256(abi.encodePacked(msg.sender, _choice, _secret)) == playerBCommitment, "Invalid parameters sent");
            playerBChoice = _choice;
        }
    }

    function calculateWinner() public {
        require(
            playerAChoice != Move.NULL && playerBChoice != Move.NULL,
            "Both players must have revealed"
        );
        require(!winnerDeclared, "The winner has already been declared");

        winnerDeclared = true;

        uint256 choiceA = uint256(playerAChoice) - 1;
        uint256 choiceB = uint256(playerBChoice) - 1;
 
        if (((choiceA + 1) % 3) == choiceB) {
            result = Result.WinnerB;
            playerBCanWithdraw = true;
        } else if (choiceA == choiceB) {
            result = Result.Draw;
            playerACanWithdraw = true;
            playerBCanWithdraw = true;
        } else {
            result = Result.WinnerA;
            playerACanWithdraw = true;
        }
    }

    function withdrawPlayerA() public {
        require(msg.sender == playerA, "Unauthorized");
        require(winnerDeclared, "Winner is not declared yet");
        require(playerACanWithdraw);

        playerACanWithdraw = false;

        if (result == Result.WinnerA) {
            (bool sent, ) = playerA.call{value: bet * 2}("");
            require(sent, "Failed to withdraw");
        }

        if (result == Result.Draw) {
            (bool sent, ) = playerA.call{value: bet}("");
            require(sent, "Failed to withdraw");
        }
    }

    function withdrawPlayerB() public {
        require(msg.sender == playerB, "Unauthorized");
        require(winnerDeclared, "Winner is not declared yet");
        require(playerBCanWithdraw);

        playerBCanWithdraw = false;

        if (result == Result.WinnerB) {
            (bool sent, ) = playerB.call{value: bet * 2}("");
            require(sent, "Failed to withdraw");
        }
        if (result == Result.Draw) {
            (bool sent, ) = playerB.call{value: bet}("");
            require(sent, "Failed to withdraw");
        }
    }

    bool timeoutCalled = false;

    function playerATimeout() public {
        require(playerACommitment != 0 && playerBCommitment != 0, "Both players must have committed");
        require(playerAChoice == Move.NULL);
        require(block.timestamp > (playersCommittedTime + timeout));
        require(!timeoutCalled);

        timeoutCalled = true;

        (bool sent, ) = playerB.call{value: bet * 2}("");
        require(sent, "Failed to withdraw");
    }

    function playerBTimeout() public {
        require(playerACommitment != 0 && playerBCommitment != 0, "Both players must have committed");
        require(playerBChoice == Move.NULL);
        require(block.timestamp > (playersCommittedTime + timeout));
        require(!timeoutCalled);

        timeoutCalled = true;

        (bool sent, ) = playerA.call{value: bet * 2}("");
        require(sent, "Failed to withdraw");
    }

    function leaveGame() public {
        require(msg.sender == playerA);
        require(playerB == address(0));

        playerA = payable(address(0));
        playerACommitment = 0x0;

        (bool sent, ) = payable(msg.sender).call{value: bet}("");
        require(sent, "Failed to withdraw");
    }
}
