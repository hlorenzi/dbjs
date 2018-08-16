const util = require("util")
const setImmediatePromise = util.promisify(setImmediate)


class ReadWriteLock
{
	constructor()
	{
		this.readingNum = 0
		this.writing = false
	}
	
	
	async acquireRead()
	{
		while (this.writing)
			await setImmediatePromise()
		
		this.readingNum += 1
	}
	
	
	releaseRead()
	{
		this.readingNum -= 1
	}
	
	
	async acquireWrite()
	{
		while (this.writing)
			await setImmediatePromise()
		
		this.writing = true
		
		while (this.readingNum > 0)
			await setImmediatePromise()
	}
	
	
	async tryAcquireWrite()
	{
		if (this.writing)
			return false
		
		this.writing = true
		
		while (this.readingNum > 0)
			await setImmediatePromise()
		
		return true
	}
	
	
	releaseWrite()
	{
		this.writing = false
	}
}


class LockerNone
{
	constructor()
	{
		
	}
	
	
	async acquireRead(keys)
	{
		await setImmediatePromise()
	}
	
	
	async releaseRead(keys)
	{
		
	}
	
	
	async acquireWrite(keys)
	{
		await setImmediatePromise()
	}
	
	
	async releaseWrite(keys)
	{
		
	}
}


class LockerGlobal
{
	constructor()
	{
		this.lock = new ReadWriteLock()
	}
	
	
	async acquireRead(keys)
	{
		//console.log("try acquire locks read [" + keys.join(",") + "]")
		await this.lock.acquireRead()
		//console.log("acquired locks read [" + keys.join(",") + "]")
	}
	
	
	async releaseRead(keys)
	{
		//console.log("released locks read [" + keys.join(",") + "]")
		await this.lock.releaseRead()
	}
	
	
	async acquireWrite(keys)
	{
		//console.log("try acquire locks write [" + keys.join(",") + "]")
		await this.lock.acquireWrite()
		//console.log("acquired locks write [" + keys.join(",") + "]")
	}
	
	
	async releaseWrite(keys)
	{
		//console.log("released locks write [" + keys.join(",") + "]")
		await this.lock.releaseWrite()
	}
}


class LockerFineGrained
{
	constructor()
	{
		this.lockMap = new Map()
		this.requestedMap = new Map()
		this.requestedReadMap = new Map()
		this.acquiredMap = new Map()
	}
	
	
	async acquireRead(keys)
	{
		//console.log("try acquire locks read [" + keys.join(",") + "]")

		for (let key of keys)
		{
			let requestedNum = this.requestedReadMap.get(key)
			if (requestedNum == null)
			{
				let lock = this.lockMap.get(key)
				if (lock == null)
				{
					lock = new ReadWriteLock()
					this.lockMap.set(key, lock)
				}
				
				//console.log("- acquire lock read " + key)
				await lock.acquireRead()
				//console.log("- acquired lock read " + key)
				this.requestedReadMap.set(key, 1)
			}
			else
				this.requestedReadMap.set(key, requestedNum + 1)
		}
		
		//console.log("- wait acquire locks read [" + keys.join(",") + "]")
		while (true)
		{
			let acquiredAll = true
			for (let key of keys)
			{
				if (!this.requestedReadMap.has(key))
				{
					acquiredAll = false
					break
				}
			}
			
			if (!acquiredAll)
				await setImmediatePromise()
			else
				break
		}
		
		//console.log("acquired locks read [" + keys.join(",") + "]")
	}
	
	
	async releaseRead(keys)
	{
		//console.log("released locks read [" + keys.join(",") + "]")
		
		for (let key of keys)
		{
			let requestedNum = this.requestedReadMap.get(key)
			if (requestedNum > 1)
				this.requestedReadMap.set(key, requestedNum - 1)
			else
			{
				this.requestedReadMap.delete(key)
				let lock = this.lockMap.get(key)
				await lock.releaseRead()
			}
		}
	}
	
	
	async acquireWrite(keys)
	{
		//console.log("try acquire locks write [" + keys.join(",") + "]")
		
		for (let key of keys)
		{
			let requestedNum = this.requestedMap.get(key)
			if (requestedNum == null)
			{
				let lock = this.lockMap.get(key)
				if (lock == null)
				{
					lock = new ReadWriteLock()
					this.lockMap.set(key, lock)
				}
				
				//console.log("- acquire lock write " + key)
				await lock.acquireWrite()
				//console.log("- acquired lock write " + key)
				this.requestedMap.set(key, 1)
			}
			else
				this.requestedMap.set(key, requestedNum + 1)
		}
		
		//console.log("- wait acquire locks write [" + keys.join(",") + "]")
		while (true)
		{
			let acquiredAll = true
			for (let key of keys)
			{
				if (!this.requestedMap.has(key))
				{
					acquiredAll = false
					break
				}
				
				let acquired = this.acquiredMap.get(key)
				if (acquired != null)
				{
					acquiredAll = false
					break
				}
			}
			
			if (!acquiredAll)
				await setImmediatePromise()
			else
			{
				for (let key of keys)
					this.acquiredMap.set(key, true)
				
				break
			}
		}
		
		//console.log("acquired locks write [" + keys.join(",") + "]")
	}
	
	
	async releaseWrite(keys)
	{
		//console.log("released locks write [" + keys.join(",") + "]")
		
		for (let key of keys)
		{
			this.acquiredMap.delete(key)
			
			let requestedNum = this.requestedMap.get(key)
			if (requestedNum > 1)
				this.requestedMap.set(key, requestedNum - 1)
			else
			{
				this.requestedMap.delete(key)
				let lock = this.lockMap.get(key)
				await lock.releaseWrite()
			}
		}
	}
}


module.exports =
{
	ReadWriteLock,
	LockerNone,
	LockerGlobal,
	LockerFineGrained
}