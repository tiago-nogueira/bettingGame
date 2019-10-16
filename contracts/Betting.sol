pragma solidity 0.5.8;

contract Betting {
	uint256 public time;
	uint256 public bet;
	uint256 public revealDeadline;
	Bet public person1;
	Bet public person2;
	bool public revealPhase;

	constructor(uint256 _time, uint256 _bet) public {
		time = _time;
		bet = _bet;
		emit BettingOpen(time, bet);
	}

	event BettingOpen(uint256 time, uint256 bet);
	event RevealPhase(bytes32 indexed hashFirstBet, bytes32 indexed hashSecondBet, uint256 indexed deadline);
	event Winner(address winner, uint256 indexed amount);

	struct Bet {
		address payable addr;
		bytes32 betHash;
		uint256 betNum;
		bool revealed;
	}

	function sendHash(bytes32 _betHash) external payable {
		require(msg.sender != person1.addr, "You already betted");
		require(!revealPhase, "Betting is in reveal phase");
		bytes32 _empty;
		require(_betHash != _empty, "Invalid bet hash");
		require(_betHash != person1.betHash, "This same hash was sent by the other player");
		require(msg.value == bet, "Wrong amount of ether");
		if(person1.betHash == _empty)
			person1 = Bet(msg.sender, _betHash, 0, false);
		else {
			person2 = Bet(msg.sender, _betHash, 0, false);
			revealPhase = true;
			revealDeadline = now + time;
			emit RevealPhase(person1.betHash, _betHash, now + time);
		}
	}

	function revealNum(uint256 _num) external {
		require(revealPhase, "Not on reveal phase yet");
		require(msg.sender == person1.addr || msg.sender == person2.addr, "Only for the players");
		bytes32 hash = keccak256(abi.encodePacked(_num));		
		if(msg.sender == person1.addr) {
			require(hash == person1.betHash, "Number should hash to the betting hash");
			person1.betNum = _num;
			person1.revealed = true;
			if(person2.revealed){
				resolve();
			}
		} else {
			require(hash == person2.betHash, "Number should hash to the betting hash");
			person2.betNum = _num;
			person2.revealed = true;
			if(person1.revealed){
				resolve();
			}
		}
	}

	function timeUp() external {
		require(revealPhase, "Not on reveal phase yet");
		require(now >= revealDeadline, "There is still time");
		uint256 amount = address(this).balance;
		if(person1.revealed) {
			person1.addr.transfer(amount);
			emit Winner(person1.addr, amount);
		}
		if (person2.revealed) {
			person2.addr.transfer(amount);
			emit Winner(person2.addr, amount);
		}
		reset();
	}

	function resolve() private {
		uint256 sum = person1.betNum + person2.betNum;
		uint256 amount = address(this).balance;
		address payable winner;
		if(sum % 2 != 0) winner = person1.addr;
		else winner = person2.addr;
		winner.transfer(amount);
		emit Winner(winner, amount);
		reset();
	}

	function reset() private {
		delete person1;
		delete person2;
		revealPhase = false;
		emit BettingOpen(time, bet);
	}
}