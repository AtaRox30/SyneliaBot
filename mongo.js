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
			"points": 0,
			"ingredients": [],
			"recipes": []
		});
		await clientDB.close();
		return cursor;
	},
	getDrinkers: async () => {
		const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
		await clientDB.connect();
		const collection = clientDB.db("discord_bot").collection("drinkers");
		const cursor = collection.find();
		const toRet = await cursor.toArray();
		await clientDB.close();
		return toRet;
	},
	insertIngredientProfile: async (selectRequest, ingredientCode) => {
		const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
		await clientDB.connect();
		const collection = clientDB.db("discord_bot").collection("drinkers");
		const cursor = await collection.updateOne(selectRequest, {
			"$push": {
				"ingredients": {
					"code": ingredientCode,
					"amount": 0
				}
			}
		});
		await clientDB.close();
		return cursor;
	},
	resetPointFromDrinker: async (selectRequest) => {
		const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
		await clientDB.connect();
		const collection = clientDB.db("discord_bot").collection("drinkers");
		const cursor = await collection.updateOne(selectRequest, {
			"$set": {
				"points" : 0
			}
		});
		await clientDB.close();
		return cursor;
	},
	incrementAmount: async (twitchId, ingredient, previousAmount) => {
		const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
		await clientDB.connect();
		const collection = clientDB.db("discord_bot").collection("drinkers");
		const cursor = await collection.updateOne(
			{ "twitchId" : twitchId, "ingredients.code" : ingredient },
			{
			"$set": {
				"ingredients.$.amount" : previousAmount + 1
			}
		});
		await clientDB.close();
		return cursor;
	},
	incrementPoints: async (twitchId, previousPoints) => {
		const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
		await clientDB.connect();
		const collection = clientDB.db("discord_bot").collection("drinkers");
		const cursor = await collection.updateOne(
			{ "twitchId" : twitchId },
			{ "$set" : { "points" : previousPoints + 1 } }
		);
		await clientDB.close();
		return cursor;
	},
}

module.exports = mongo;