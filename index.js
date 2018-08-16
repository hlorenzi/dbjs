const { Database } = require("./database.js")
const { BackendFileSystem } = require("./backend_fs.js")
const { BackendRAM } = require("./backend_ram.js")
const { LockerNone, LockerGlobal, LockerFineGrained } = require("./rwlock")
const setImmediatePromise = require("util").promisify(setImmediate)


//const db = new Database(new BackendRAM(), new LockerGlobal())
//const db = new Database(new BackendRAM(), new LockerFineGrained())
//const db = new Database(new BackendFileSystem("db"))


function makeRNG(seed)
{
    let lcg = (a) => (a * 48271 % 2147483647)
	
    seed = lcg(seed)
	
    return () => ((seed = lcg(seed)) / 2147483648)
}


async function timeIt(fn)
{
	const startTime = Date.now()
	await fn()
	const endTime = Date.now()
	
	return ((endTime - startTime) / 1000)
}


async function testDatabase(db, seed, accountNum, opsNum)
{
	{
		let txn = await db.newTransaction([".node1"])
		let node1 = await txn.get(".node1")
		
		if (node1 == null)
			node1 = { counter: 0 }
		
		node1.counter += 1
		
		await txn.set(".node1", node1)
		await txn.commit()
	}
	
	for (let i = 0; i < accountNum; i++)
	{
		let txn = await db.newTransaction([i.toString()])
		
		let value = { balance: 0 }
		
		await txn.set(i.toString(), value)
		await txn.commit()
	}
	
	let totalBalance = 0
	for (let i = 0; i < accountNum; i++)
	{
		let value = await db.get(i.toString())
		totalBalance += value.balance
	}
	
	if (totalBalance != 0)
		console.log("![" + totalBalance + "]")
	
	let transfer = async (from, to, amount) =>
	{
		let txn = await db.newTransaction([from, to])
		
		let fromAccount = await txn.get(from)
		let toAccount = await txn.get(to)
		
		/*if (fromAccount == null || toAccount == null || fromAccount.balance < amount)
		{
			await txn.abort()
			return
		}*/
		
		fromAccount.balance -= amount
		toAccount.balance += amount
		
		await txn.set(from, fromAccount)
		await txn.set(to, toAccount)
		await txn.commit()
		//console.log("transferred $" + amount + " from " + from + " to " + to)
	}
	
	return await timeIt(async () =>
	{
		let opsDone = 0
		let random = makeRNG(seed)
		
		for (let i = 0; i < opsNum / 2; i++)
		{
			let from = Math.floor(random() * accountNum)
			let to = Math.floor(random() * accountNum)
			let read = Math.floor(random() * accountNum)
			
			while (to == from)
				to = Math.floor(random() * accountNum)
			
			setImmediate(async () =>
			{
				await transfer(from.toString(), to.toString(), 1)
				opsDone += 1
			})
			
			setImmediate(async () =>
			{
				await db.get(read.toString())
				//console.log("read " + from)
				opsDone += 1
			})
		}
		
		while (opsDone < opsNum)
			await setImmediatePromise()
	})
}


setImmediate(async () =>
{
	console.log("begin benchmarks")
	console.log("")
	
	let dbTypes =
	[	
		[ "RAM/FineGrained", () => new Database(new BackendRAM(),            new LockerFineGrained()) ],
		[ "RAM/Global",      () => new Database(new BackendRAM(),            new LockerGlobal())      ],
		[ "FS/FineGrained",  () => new Database(new BackendFileSystem("db"), new LockerFineGrained()) ],	
		[ "FS/Global",       () => new Database(new BackendFileSystem("db"), new LockerGlobal())      ],
		[ "RAM/None",        () => new Database(new BackendRAM(),            new LockerNone())        ],
	]
	
	let seed = Math.random()
	let results = []
	
	for (let dbType = 0; dbType < dbTypes.length; dbType += 1)
	{
		for (let accNum = 100; accNum <= 1000; accNum += 100)
		{
			let prevTimeTaken = 0
			for (let opsNum = 1000; opsNum <= 5000; opsNum += 1000)
			{
				let db = dbTypes[dbType][1]()
				
				let timeTaken = await testDatabase(db, seed, accNum, opsNum)
				
				let result =
				{
					dbType: dbType,
					timeTaken: timeTaken,
					accNum: accNum,
					opsNum: opsNum,
					totalBalance: 0,
					accounts: []
				}
				
				for (let i = 0; i < accNum; i++)
				{
					let value = await db.get(i.toString())
					result.accounts[i] = value.balance
					result.totalBalance += value.balance
				}
				
				results.push(result)
				
				let str = dbTypes[dbType][0].padStart(20) + " "
				str += "[" + result.accNum.toString().padStart(5) + " acc, " + result.opsNum.toString().padStart(5) + " ops]: "
				str += result.timeTaken.toFixed(3).padStart(7) + " s, "
				str += (opsNum / timeTaken).toFixed(3).padStart(10) + " ops/s"
				
				if (prevTimeTaken != 0)
					str += " (+" + (result.timeTaken - prevTimeTaken).toFixed(3).padStart(7) + " s from prev)"
				
				if (result.totalBalance != 0)
					str += " [!] error: total balance = " + result.totalBalance
				
				let allEqual = true
				for (let compareResult of results)
				{
					if (compareResult.accNum != accNum ||
						compareResult.opsNum != opsNum)
						continue
						
					for (let i = 0; i < accNum; i++)
						allEqual &= (compareResult.accounts[i] == result.accounts[i])
				}
				
				if (!allEqual)
					str += " [!] error: result discrepancy"
				
				console.log(str)
				
				prevTimeTaken = timeTaken
			}
			
			console.log("")
		}
	}
})