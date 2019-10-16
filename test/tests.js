const Betting = artifacts.require("Betting");
const config = require("../config.js");

contract("Betting", accounts => {
	let Instance;
	let bet = config.bet;
	let time = config.time;
	let addressZero = "0x0000000000000000000000000000000000000000";
	let zeroString = padHex("0x");

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

	function checkPerson(person, addr, hash, num, revealed) {
		assert.equal(person.addr, addr);
		assert.equal(person.betHash, hash);
		assert.equal(person.betNum.toNumber(), num);
		assert.equal(person.revealed, revealed);
	}

	function fail(err, msg) {
		assert(err.message.indexOf(msg) >= 0);		
	}

	beforeEach(() => {
		Betting.deployed().then(instance => {
			Instance = instance;
		});
	});

	it("checks initial value: time", () => {
		return Betting.deployed().then(instance => {
			return instance.time.call()
			.then(_time => {
				assert.equal(_time, time);
			});
		});
	});

	it("checks initial value: bet", () => {
		return Instance.bet.call()
		.then(_bet => {
			assert.equal(_bet, bet);
		});
	});

	it("checks initial value: reveal phase?", () => {
		return Instance.revealPhase.call()
		.then(bool => {
			assert(!bool);
		});
	});

	it("player sends hash", () => {
		return Instance.sendHash(keccak(1234), {from: accounts[0], value: bet})
		.then(() => {
			return Instance.person1.call();
		}).then(person => {
			return checkPerson(person, accounts[0], keccak(1234), 0, false)
		});
	});

	it("tries to send hash again", () => {
		return Instance.sendHash(keccak(1234), {from: accounts[0], value: bet})
		.then(assert.fail).catch(error => {
			return fail(error, "You already betted");
		});
	});

	it("tries to send hash with the wrong amount of ether", () => {
		return Instance.sendHash(keccak(12345), {from: accounts[1], value: bet + 1})
		.then(assert.fail).catch(error => {
			return fail(error, "Wrong amount of ether");
		});
	});

	it("tries to send invalid hash", () => {
		return Instance.sendHash(zeroString, {from: accounts[1], value: bet})
		.then(assert.fail).catch(error => {
			return fail(error, "Invalid bet hash");
		});
	});

	it("tries to send repeated hash", () => {
		return Instance.sendHash(keccak(1234), {from: accounts[1], value: bet})
		.then(assert.fail).catch(error => {
			return fail(error, "This same hash was sent by the other player");
		});
	});

	it("first player tries to reveal the number before the reveal phase", () => {
		return Instance.revealNum(keccak(1234), {from: accounts[0]})
		.then(assert.fail).catch(error => {
			return fail(error, "Not on reveal phase yet");
		});
	});

	it("tries to trigger the time up", () => {
		return Instance.timeUp()
		.then(assert.fail).catch(error => {
			return fail(error, "Not on reveal phase yet");
		});
	});

	it("second player sends bet hash", () => {
		return Instance.sendHash(keccak(12345), {from: accounts[1], value: bet})
		.then(receipt => {
			let _time = receipt.logs[0].args[2];
			assert.isAtMost(_time.toNumber(), time + Date.now() / 1000);
			assert.isAtLeast(_time.toNumber() + 5, time + Date.now() / 1000);
			receipt.logs[0].args.__length__ = 2;
			return checkReceipt(receipt, "RevealPhase", keccak(1234), keccak(12345));
		}).then(() => {
			return Instance.person2.call();
		}).then(person => {
			return checkPerson(person, accounts[1], keccak(12345), 0, false);
		});
	});

	it("tries to send hash during reveal phase", () => {
		return Instance.sendHash(keccak(12345678), {from: accounts[2], value: bet})
		.then(assert.fail).catch(error => {
			return fail(error, "Betting is in reveal phase");
		});
	});

	it("someone one than the players tries to reveal a number", () => {
		return Instance.revealNum(0, {from: accounts[3]})
		.then(assert.fail).catch(error => {
			return fail(error, "Only for the players");
		});
	});

	it("player two tries to send wrong number", () => {
		return Instance.revealNum(0, {from: accounts[1]})
		.then(assert.fail).catch(error => {
			return fail(error, "Number should hash to the betting hash");
		});
	});

	it("player two reveals his number", () => {
		return Instance.revealNum(12345, { from: accounts[1] })
		.then(() => {
			return Instance.person2.call();
		}).then(person => {
			return checkPerson(person, accounts[1], keccak(12345), 12345, true)
		});
	});

	it("tries to trigger the time up before the deadline", () => {
		return Instance.timeUp()
		.then(assert.fail).catch(error => {
			return fail(error, "There is still time");
		});
	});

	it("player 1 sends his number", () => {
		return Instance.revealNum(1234, { from: accounts[0] })
		.then(receipt => {
			checkReceipt({logs: [receipt.logs.pop()]}, "BettingOpen", time, bet);
			return checkReceipt(receipt, "Winner", accounts[0], 2*bet);
		});
	});

	it("checks if the variables were reset", () => {
		return Instance.person1.call()
		.then(person => {
			return checkPerson(person, addressZero, zeroString, 0, false);
		}).then(() => {
			return Instance.person2.call();
		}).then(person => {
			return checkPerson(person, addressZero, zeroString, 0, false);
		}).then(() => {
			return Instance.revealPhase.call();
		}).then(bool => {
			assert(!bool);
		});
	});
});