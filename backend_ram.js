const utils = require("./utils")


class BackendRAM
{
	constructor()
	{
		this.objects = new Map()
	}
	
	
	async create(value)
	{
		let valueStr = JSON.stringify(value)
		
		while (true)
		{
			const key = utils.generateRandomId()
			
			if (this.objects.has(key))
				continue
			
			this.objects.set(key, valueStr)
			//console.log("ram: create object: " + key)
			//console.log(valueStr + "\n")
			return key
		}
	}
	
	
	async get(key)
	{
		//console.log("ram: read object: " + key)
		
		let valueStr = this.objects.get(key)
		if (valueStr !== undefined)
		{
			//console.log(valueStr + "\n")
			return JSON.parse(valueStr)
		}
		else
			return null
	}
	
	
	async set(key, value)
	{
		let valueStr = JSON.stringify(value)
		
		this.objects.set(key, valueStr)
		//console.log("ram: write object: " + key)
		//console.log(valueStr + "\n")
	}
	
	
	async remove(key)
	{
		this.objects.delete(key)
		//console.log("ram: remove object: " + key)
	}
}


module.exports =
{
	BackendRAM
}