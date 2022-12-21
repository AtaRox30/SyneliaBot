const { MongoClient, ServerApiVersion } = require('mongodb');
const config = require('./config.json');

const mongo = {
	getGlobalInfo: async () => {
		const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
		await clientDB.connect();
		const collection = clientDB.db("discord_bot").collection("global_info");
		const cursor = collection.find({ "name_id" : config["MONGO"]["NAME"] });
		const toRet = (await cursor.toArray())[0];
		await clientDB.close();
		return toRet;
	},

	setGlobalInfo: async (document) => {
		const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
		await clientDB.connect();
		const collection = clientDB.db("discord_bot").collection("global_info");
		const cursor = await collection.updateOne({ "name_id" : config["MONGO"]["NAME"] }, { "$set": document });
		await clientDB.close();
		return cursor;
	}
}

module.exports = mongo;