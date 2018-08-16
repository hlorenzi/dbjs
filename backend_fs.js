const utils = require("./utils")
const util = require("util")
const fs = require("fs")
const fsWriteFile = util.promisify(fs.writeFile)
const fsReadFile = util.promisify(fs.readFile)
const fsOpen = util.promisify(fs.open)
const fsTruncate = util.promisify(fs.ftruncate)
const fsWrite = util.promisify(fs.write)
const fsClose = util.promisify(fs.close)
const fsUnlink = util.promisify(fs.unlink)


class BackendFileSystem
{
	constructor(folder)
	{
		this.folder = folder
		
		try
		{
			fs.mkdirSync(this.folder)
		}
		catch (err)
		{
			if (err.code != "EEXIST")
				throw err
		}
	}
	
	
	async create(value)
	{
		let valueStr = JSON.stringify(value)
		
		while (true)
		{
			const key = utils.generateRandomId()
			
			try
			{
				await fsWriteFile(this.folder + "/" + key, valueStr, { flag: "wx" })
				//console.log("fs: create object: " + key)
				//console.log(valueStr + "\n")
				return key
			}
			catch (err)
			{
				console.error(err)
			}
		}
	}
	
	
	async get(key)
	{
		//console.log("fs: read object: " + key)
		
		try
		{
			let valueStr = await fsReadFile(this.folder + "/" + key, "utf8")
			//console.log(valueStr + "\n")
			return JSON.parse(valueStr)
		}
		catch (err)
		{
			if (err.code == "ENOENT")
				return null
			
			throw err
		}
	}
	
	
	async set(key, value)
	{
		let valueStr = JSON.stringify(value)
		
		try
		{
			let file = await fsOpen(this.folder + "/" + key, "r+")
			await fsTruncate(file, 0)
			await fsWrite(file, valueStr, 0, "utf8")
			await fsClose(file)
			
			//console.log("fs: write object: " + key)
			//console.log(valueStr + "\n")
			return
		}
		catch (err)
		{
			if (err.code == "ENOENT")
			{
				await fsWriteFile(this.folder + "/" + key, valueStr, { flag: "wx" })
				//console.log("fs: write new object: " + key)
				//console.log(valueStr + "\n")
				return
			}
			
			throw err
		}
	}
	
	
	async remove(key)
	{
		await fsUnlink(this.folder + "/" + key)
	}
}


module.exports =
{
	BackendFileSystem
}