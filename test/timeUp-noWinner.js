const Betting = artifacts.require("Betting");
const config = require("../config.js");

contract("Betting-timeUp-noWinner", accounts => {
	let Instance;
	let bet = config.bet;
	let time = config.time;

	function padHex(str) {
		str = str.slice(2);
		while(str.length < 64) {
			str = "0" + str;
		}
		return "0x" + str;
	}

	function keccak(num) {
		return web3.utils.keccak256(
			padHex(
				web3.utils.numberToHex(num)
			)
		);
	}

	function checkReceipt(receipt, event, ...args) {
		assert.equal(receipt.logs.length, 1, "One event must be emited");
		assert.equal(receipt.logs[0].args.__length__, args.length, `Event must have ${args.length} arguments`);
		assert.equal(receipt.logs[0].event, event);
		for(let i = 0; i < args.length; i++) {
			assert.equal(receipt.logs[0].args[i], args[i] , `Argument ${i} must be: '${args[i]}'`);
		}		
	}

	beforeEach(() => {
		Betting.deployed().then(instance => {
			Instance = instance;
		});
	});

	it("sends both hashes", () => {
		return Betting.deployed().then(instance => {
			return Instance.sendHash(keccak(1212), { from: accounts[0], value: bet })
			.then(() => {
				return Instance.sendHash(keccak(123), { from: accounts[1], value: bet });
			});
		});
	});

	it("waits until the time is up", () => {
		return Instance.revealDeadline.call()
		.then(deadline => {
			while(Date.now() / 1000 <= deadline) {}
		});
	});

	it("calls the 'timeUp'", () => {
		return Instance.timeUp({ from: accounts[9] })
		.then(receipt => {
			return checkReceipt(receipt, "BettingOpen", time, bet);
		});
	});

	it("sends new hashes", () => {
		return Betting.deployed().then(instance => {
			return Instance.sendHash(keccak(111), { from: accounts[3], value: bet })
			.then(() => {
				return Instance.sendHash(keccak(123), { from: accounts[4], value: bet });
			});
		});
	});

	it("reveals both hashes", () => {
		return Betting.deployed().then(instance => {
			return Instance.revealNum(111, { from: accounts[3] });
		}).then(() => {
			return Instance.revealNum(123, { from: accounts[4] });
		}).then(receipt => {
			checkReceipt({logs: [receipt.logs.pop()]}, "BettingOpen", time, bet);
			return checkReceipt(receipt, "Winner", accounts[4], 4*bet);
		});
	});
});