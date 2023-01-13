const { MongoClient, ServerApiVersion } = require('mongodb');
const config = require('./config.json');
const ingredients = require('./ingredients.json');
const recipes = require('./recipes.json');

function S4() {
	return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}

function guid() {
	return (S4() + S4() + "-" + S4() + "-4" + S4().slice(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
}

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
	addRecipe: async (discordId, recipe_key, xp) => {
		const cursor = await mongo.updateDrinkerProfile(
			{ "discordId" : discordId },
			{
				"$push" : { "recipes" : 
					{
						"id": guid(),
						"code": recipe_key,
						"label": recipes[recipe_key].name,
						"xp": xp,
						"time": new Date(new Date().toUTCString()).toISOString(),
						"is_finished": false
					}
				}
			}
		);
		return cursor;
	},
	retreiveIngredients: async (discordId, ingredientsObject) => {
		const drinker = await mongo.getDrinkerProfile({ "discordId" : discordId });
		const promiseArray = [];
		drinker.ingredients.forEach(v => {
			const amountToRetreive = ingredientsObject[v.code];
			if(!amountToRetreive) return;
			const finalResult = v.amount - amountToRetreive;
			const promise = mongo.updateDrinkerProfile(
				{ "discordId" : discordId },
				{
					"$set" : { "ingredients.$[elem].amount" : finalResult > 0 ? finalResult : 0 }
				},
				{ "arrayFilters": [ { "elem.code": v.code } ] }
			);
			promiseArray.push(promise);
		});
		Promise.all(promiseArray).then(() => Promise.all(promiseArray)).then(async (data) => {
			const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
			await clientDB.connect();
			const collection = clientDB.db("discord_bot").collection("drinkers");
			const cursor = await collection.updateMany(
				{},
				{
					"$pull": {
						"ingredients" : { "amount" : 0 }
					}
				}
			);
			await clientDB.close();
			return [...data, cursor];
		});
	},
	setAll10Ingredients: async () => {
		const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
		await clientDB.connect();
		const collection = clientDB.db("discord_bot").collection("drinkers");
		await collection.updateOne(
			{ "discordId" : "236174876933619713" },
			{
				"$set": { "ingredients" : [] }
			}
		);
		const aToPush = [];
		Object.keys(ingredients).forEach(v => aToPush.push({"code": v, "amount": 10}));
		await collection.updateOne(
			{ "discordId" : "236174876933619713" },
			{
				"$push": { "ingredients" : { "$each" : aToPush } }
			}
		);
		await clientDB.close();
	}
}

module.exports = mongo;