require('dotenv').config();
const axios = require('axios');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, Events } = require('discord.js');
const twitch = require('./twitch');
const commandsManager = require('./deploy-commands');
const config = require('./config.json');
// const ingredients = require('./ingredients.json');
// const teaGameManager = require('./tea-game.json');
const { MongoClient, ServerApiVersion } = require('mongodb');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const commands = commandsManager.commands;
// const drinkers = teaGameManager.data;
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

const keepAlive = () => {
	let count = 0;
	setInterval(() => {
		axios.get(process.env.URL_FETCH).then(() => {
			console.log(`[${++count}] My ping is the following ${process.env.URL_FETCH}`);
		})
	}, 300000);
}

const getGlobalInfo = async () => {
	const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
	await clientDB.connect();
	const collection = await clientDB.db("discord_bot").collection("global_info");
	const cursor = await collection.find({ "name_id" : config["MONGO"]["NAME"] });
	const toRet = (await cursor.toArray())[0];
	await clientDB.close();
	return toRet;
}

const setGlobalInfo = async (document) => {
	const clientDB = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
	await clientDB.connect();
	const collection = await clientDB.db("discord_bot").collection("global_info");
	const cursor = await collection.updateOne({ "name_id" : config["MONGO"]["NAME"] }, { "$set": document });
	return cursor;
}

const twitchStreamChecker = async () => {
	const channel = await checkStream();
	// checkVODS(channel);
	checkClips(channel);
};

// const twitchChatChecker = async () => {
// 	const tenDrinker = await distributePoint();
// 	await distributeIngredient(tenDrinker);
// };

const checkStream = async () => {
	const channel = await twitch.getChannel();
	const info = await getGlobalInfo();
	if(!info.is_live && channel.is_live)
	{
		//Streamer wasn't streaming the last time we checked, but is streaming now, so we send
		notifyStream(channel);
	}
	setGlobalInfo({ "is_live" : channel.is_live });
	return channel;
}

const checkVODS = async (channel) => {
	const aVods = await twitch.getVODS();
	const info = await getGlobalInfo();
	const aNotified = aVods.filter(v => !info.vods.includes(v.id)).sort((a, b) => new Date(a.created_at) < new Date(b.created_at)).reverse();
	if(aNotified.length)
	{
		//At least one video found, notify
		notifyVods(channel, aNotified);
	}
	setGlobalInfo({ "vods" : aVods.map(v => v.id) });
}

const checkClips = async (channel) => {
	const aClips = await twitch.getClips();
	const info = await getGlobalInfo();
	const aNotified = aClips.filter(v => !info.clips.includes(v.id)).sort((a, b) => new Date(a.created_at) < new Date(b.created_at)).reverse();
	if(aNotified.length)
	{
		//At least one video found, notify
		notifyClips(channel, aNotified);
	}
	setGlobalInfo({ "clips" : aClips.map(v => v.id) });
}

// const distributePoint = async () => {
// 	// const chatters = await twitch.getChatters();
// 	const chatters = ["atarox30"];
// 	const ret = [];
// 	chatters.forEach(chatter => {
// 		const drinker = drinkers.filter(v => v.twitch.login === chatter);
// 		if(!drinker.length) return
// 		drinker[0].points = drinker[0].points + 1;
// 		if(drinker[0].points >= 10) ret.push(drinker[0]);
// 		fs.writeFileSync("./tea-game.json", JSON.stringify(teaGameManager, null, 4));
// 	});
// 	return ret;
// }

// const distributeIngredient = async (worthDrinkers) => {
// 	worthDrinkers.forEach(v => {
// 		const ingredient = getRandomIngredient();
// 		v.points = 0;
// 		v.ingredients[ingredient] = (v.ingredients[ingredient] ?? 0) + 1;
// 		fs.writeFileSync("./tea-game.json", JSON.stringify(teaGameManager, null, 4));
// 	});
// }

// const getRandomIngredient = () => {
// 	const toGive = [];
// 	Object.entries(ingredients).forEach(k => {
// 		for(let i = 0; i < k[1].weight; i++) toGive.push(k[0]);
// 	});
// 	toGive.sort((a, b) => 0.5 - Math.random());
// 	const ingredient = toGive[Math.floor(Math.random() * toGive.length)]
// 	return ingredient;
// }

const notifyStream = async (channel) => {
	/*
		channel {
			display_name: string,
			game_id: string,
			game_name: string,
			thumbnail_url: string,
			title: string
		}
	*/
	const replaceEnv = (string) => string.replace("$TITRE", channel.title)
		.replace("$IMG", channel.thumbnail_url)
		.replace("$NOM", channel.display_name)
		.replace("$JEU", channel.game_name);

	const guild = client.guilds.cache.get(config["DISCORD"]["GUILD_ID"]);
	const channelDisc = guild.channels.cache.get(config["DISCORD"]["CHANNELS"]["ONLINE"]);
	const embed = new EmbedBuilder()
		.setColor(replaceEnv(config["STREAM_ALERT_MESSAGE"]["COLOR"]))
		.setTitle(replaceEnv(config["STREAM_ALERT_MESSAGE"]["TITLE"]))
		.setURL('https://www.twitch.tv/syneliasan')
		.setAuthor({ name: channel.display_name, iconURL: channel.thumbnail_url, url: 'https://www.twitch.tv/syneliasan' })
		.setDescription(replaceEnv(config["STREAM_ALERT_MESSAGE"]["DESCRIPTION"]))
		.setThumbnail(replaceEnv(config["STREAM_ALERT_MESSAGE"]["THUMBNAIL"]))

	await channelDisc.send({
		content: '@everyone',
		embeds: [embed]
	});
}

const notifyVods = async (channel, aVods) => {
	aVods.forEach(async vod => {
		/*
			channel {
				display_name: string,
				game_id: string,
				game_name: string,
				thumbnail_url: string,
				title: string
			}

			vod {
				id: string,
				user_name: string,
				title: string,
				published_at: string,
				url: string,
				thumbnail_url: string,
				description: string
			}

			game {
				id: string,
				name: string,
				box_art_url: string,
				igdb_id: string
			}
		*/
		const game = await twitch.getGame(channel.game_id);
		const thumbGame = game.box_art_url.replace("{width}", 285).replace("{height}", 380);
		const thumbVideo = vod.thumbnail_url.replace("%{width}", 800).replace("%{height}", 450);
		const guild = client.guilds.cache.get(config["DISCORD"]["GUILD_ID"]);
		const channelDisc = guild.channels.cache.get(config["DISCORD"]["CHANNELS"]["VOD"]);
		const exampleEmbed = new EmbedBuilder()
			.setColor(0xB07705)
			.setTitle(vod.title)
			.setURL(vod.url)
			.setAuthor({ name: vod.user_name, iconURL: channel.thumbnail_url, url: 'https://www.twitch.tv/syneliasan' })
			.setDescription(vod.description.length ? vod.description : "Aucune description")
			.setThumbnail(thumbGame)
			.setImage(thumbVideo)

		await channelDisc.send({
			embeds: [exampleEmbed]
		});
	});
}

const notifyClips = (channel, aClips) => {
	aClips.forEach(async clip => {
		/*
			channel {
				display_name: string,
				game_id: string,
				game_name: string,
				thumbnail_url: string,
				title: string
			}

			clip {
				id: string,
				url: string,
				broadcaster_name: string,
				creator_name: string,
				creator_id: string,
				video_id: string,
				game_id: string,
				title: string,
				created_at: string,
				thumbnail_url: string
			}

			game {
				id: string,
				name: string,
				box_art_url: string,
				igdb_id: string
			}

			creator {
				id: string,
				profile_image_url: string
			}
		*/

		const game = await twitch.getGame(clip.game_id);
		const creator = await twitch.getUser(clip.creator_id);
		const thumbGame = game.box_art_url.replace("{width}", 285).replace("{height}", 380);
		const thumbVideo = clip.thumbnail_url.replace("%{width}", 800).replace("%{height}", 450);
		const guild = client.guilds.cache.get(config["DISCORD"]["GUILD_ID"]);
		const channelDisc = guild.channels.cache.get(config["DISCORD"]["CHANNELS"]["CLIPS"]);
		const exampleEmbed = new EmbedBuilder()
			.setColor(0x4A9428)
			.setTitle(clip.title)
			.setURL(clip.url)
			.setAuthor({ name: clip.creator_name, iconURL: creator.profile_image_url })
			.setThumbnail(thumbGame)
			.setImage(thumbVideo)

		await channelDisc.send({
			embeds: [exampleEmbed]
		});
	});
}

const registerCommands = () => {
	(async () => {
		try {
			console.log(`Started refreshing ${commands.length} application (/) commands.`);
	
			// The put method is used to fully refresh all commands in the guild with the current set
			const data = await rest.put(
				Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, config["DISCORD"]["GUILD_ID"]),
				{ body: commands.map(v => v.data) },
			);
	
			console.log(`Successfully reloaded ${data.length} application (/) commands.`);
		} catch (error) {
			// And of course, make sure you catch and log any errors!
			console.error(error);
		}
	})();
}

const commandsHandler = async (interaction) => {
	const command = commands.filter(v => v.data.name === interaction.commandName);

	if (!command.length) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command[0].execute(client, interaction);
	} catch (error) {
		console.error(`Error executing ${interaction.commandName}`);
		console.error(error);
	}
}

const modalSubmitHandler = async (interaction) => {
	const command = commands.filter(v => v.data.name === interaction.customId);

	if (!command.length) {
		console.error(`No command matching ${interaction.customId} was found.`);
		return;
	}

	try {
		await command[0].submit(interaction);
	} catch (error) {
		console.error(`Error executing ${interaction.customId}`);
		console.error(error);
	}
}

client.on("ready", async () => {
    console.log("Discord bot ready");
	setInterval(twitchStreamChecker, 10000);
	// setInterval(twitchChatChecker, 60000);
});

client.on(Events.InteractionCreate, async interaction => {
	if(interaction.isChatInputCommand()) return commandsHandler(interaction);
	if(interaction.isModalSubmit()) return modalSubmitHandler(interaction);
});

client.login(process.env.DISCORD_BOT_TOKEN);

keepAlive();
registerCommands();