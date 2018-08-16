const utils = require("./utils")
const fs = require("fs")


class Database
{
	constructor(backend, locker)
	{
		this.backend = backend
		this.locker = locker
	}
	
	
	async newTransaction(keys)
	{
		let txn = new Transaction(this, keys)
		await txn.acquireLocks()
		return txn
	}
	
	
	async get(key)
	{
		await this.locker.acquireRead([key])
		let value = await this.backend.get(key)
		await this.locker.releaseRead([key])
		return value
	}
}


class Transaction
{
	constructor(db, keys)
	{
		this.db = db
		this.keys = keys
	}
	
	
	async acquireLocks()
	{
		await this.db.locker.acquireWrite(this.keys)
	}
	
	
	async releaseLocks()
	{
		await this.db.locker.releaseWrite(this.keys)
	}
	
	
	async commit()
	{
		await this.releaseLocks()
	}
	
	
	async abort()
	{
		await this.releaseLocks()
	}
	
	
	ensureKeyInTransaction(key)
	{
		if (this.keys.find(k => key == k) == null)
			throw ("key `" + key + "` not in transaction")
	}
	
	
	async create()
	{
		let key = await this.db.backend.create({})
		this.keys.push(key)
		return key
	}
	
	
	async get(key)
	{
		this.ensureKeyInTransaction(key)
		return await this.db.backend.get(key)
	}
	
	
	async set(key, value)
	{
		this.ensureKeyInTransaction(key)
		return await this.db.backend.set(key, value)
	}
	
	
	async remove(key)
	{
		this.ensureKeyInTransaction(key)
		return await this.db.backend.remove(key)
	}
}


module.exports =
{
	Database
}