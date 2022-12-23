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
	setGlobalInfo: async (update, options) => {
		const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
		await clientDB.connect();
		const collection = clientDB.db("discord_bot").collection("global_info");
		const cursor = await collection.updateOne({ "name_id" : config["MONGO"]["NAME"] }, update, options);
		await clientDB.close();
		return cursor;
	},
	getDrinkerProfile: async (selectRequest) => {
		const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
		await clientDB.connect();
		const collection = clientDB.db("discord_bot").collection("drinkers");
		const cursor = collection.find(selectRequest);
		const toRet = (await cursor.toArray())[0];
		await clientDB.close();
		return toRet;
	},
	updateDrinkerProfile: async (selectRequest, updateRequest, options) => {
		const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
		await clientDB.connect();
		const collection = clientDB.db("discord_bot").collection("drinkers");
		const cursor = await collection.updateOne(selectRequest, updateRequest, options);
		await clientDB.close();
		return cursor;
	},
	insertDrinkerProfile: async (discordId, twitchLogin) => {
		const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
		await clientDB.connect();
		const collection = clientDB.db("discord_bot").collection("drinkers");
		const cursor = await collection.insertOne({
			"discordId": discordId,
			"twitchId": twitchLogin,
			"ingredients": [],
			"recipes": []
		});
		await clientDB.close();
		return cursor;
	}
}

module.exports = mongo;