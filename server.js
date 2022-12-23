require('dotenv').config();
const axios = require('axios');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, Events } = require('discord.js');
const twitch = require('./twitch');
const youtube = require('./youtube');
const mongo = require('./mongo');
const commandsManager = require('./deploy-commands');
const config = require('./config.json');
const ingredients = require('./ingredients.json');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const commands = commandsManager.commands;
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

const twitchChecker = async () => {
	const channel = await checkStream();
	checkClips(channel);
};

const youtubeChecker = async () => {
	const channel = await twitch.getChannel();
	checkVODS(channel);
};

const twitchChatChecker = async () => {
	const channel = await twitch.getChannel();
	if(channel.is_live)
	{
		const tenDrinker = await distributePoint();
		await distributeIngredient(tenDrinker);
	}
};

const checkStream = async () => {
	const channel = await twitch.getChannel();
	const info = await mongo.getGlobalInfo();
	if(!info.is_live && channel.is_live)
	{
		//Streamer wasn't streaming the last time we checked, but is streaming now, so we send
		notifyStream(channel);
	}
	mongo.setGlobalInfo({ "$set" : { "is_live" : channel.is_live } });
	return channel;
}

const checkVODS = async (channel) => {
	try {
		const aVods = await youtube.getVODS();
		const info = await mongo.getGlobalInfo();
		const aNotified = aVods.filter(v => !info.vods.includes(v.id)).sort((a, b) => new Date(a.publishedAt) < new Date(b.publishedAt)).reverse();
		if(aNotified.length)
		{
			//At least one video found, notify
			notifyVods(channel, aNotified);
		}
		mongo.setGlobalInfo(
			{ "$push" : { "vods" : { "$each" : aNotified.map(v => v.id) } } },
			{ "upsert" : true }
		);
	} catch(e) {
		console.log(e);
	}
}

const checkClips = async (channel) => {
	const aClips = await twitch.getClips();
	const info = await mongo.getGlobalInfo();
	const aNotified = aClips.filter(v => !info.clips.includes(v.id))
		.filter(v => v.title !== channel.title).sort((a, b) => new Date(a.created_at) < new Date(b.created_at)).reverse();
	if(aNotified.length)
	{
		//At least one video found, notify
		notifyClips(channel, aNotified);
	}
	mongo.setGlobalInfo(
		{ "$push" : { "clips" : { "$each" : aNotified.map(v => v.id) } } },
		{ "upsert" : true }
	);
}

const distributePoint = async () => {
	const chatters = await twitch.getChatters();
	const drinkers = await mongo.getDrinkers();
	const ret = [];
	chatters.forEach(chatter => {
		const drinker = drinkers.filter(v => v.twitchId === chatter);
		if(!drinker.length) return
		mongo.incrementPoints(drinker[0].twitchId, drinker[0].points);
		if(drinker[0].points >= 9) ret.push(drinker[0]);
	});
	return ret;
}

const distributeIngredient = async (worthDrinkers) => {
	worthDrinkers.forEach(async v => {
		let haveAmount = true;
		const ingredient = getRandomIngredient();
		const currentIngredientStat = v.ingredients.filter(v => v.code === ingredient);
		if(currentIngredientStat.length === 0)
		{
			await mongo.insertIngredientProfile({ "twitchId" : v.twitchId }, ingredient);
			haveAmount = false;
		}
		mongo.resetPointFromDrinker({ "twitchId" : v.twitchId });
		mongo.incrementAmount(v.twitchId, ingredient, (haveAmount ? currentIngredientStat[0].amount : 0));
	});
}

const getRandomIngredient = () => {
	const toGive = [];
	Object.entries(ingredients).forEach(k => {
		for(let i = 0; i < k[1].weight; i++) toGive.push(k[0]);
	});
	toGive.sort((a, b) => 0.5 - Math.random());
	const ingredient = toGive[Math.floor(Math.random() * toGive.length)]
	return ingredient;
}

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
  
  const storedAlert = (await mongo.getGlobalInfo()).stream_alert_message;
  
	const replaceEnv = (string) => string.replace("$TITRE", channel.title)
		.replace("$IMG", channel.thumbnail_url)
		.replace("$NOM", channel.display_name)
		.replace("$JEU", channel.game_name);

	const guild = client.guilds.cache.get(config["DISCORD"]["GUILD_ID"]);
	const channelDisc = guild.channels.cache.get(config["DISCORD"]["CHANNELS"]["ONLINE"]);
	const embed = new EmbedBuilder()
		.setColor(replaceEnv(storedAlert.color))
		.setTitle(replaceEnv(storedAlert.title))
		.setURL('https://www.twitch.tv/syneliasan')
		.setAuthor({ name: channel.display_name, iconURL: channel.thumbnail_url, url: 'https://www.twitch.tv/syneliasan' })
		.setDescription(replaceEnv(storedAlert.description))
		.setThumbnail(replaceEnv(storedAlert.thumbnail))

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
				publishedAt: string,
				title: string,
				description: string,
				thumbnails: Thumbnail
			}

			Thumbnail {
				"default": {
					"url": string,
					"width": number,
					"height": number
				},
				"medium": {
					"url": string,
					"width": number,
					"height": number
				},
				"high": {
					"url": string,
					"width": number,
					"height": number
				},
				"standard": {
					"url": string,
					"width": number,
					"height": number
				},
				"maxres": {
					"url": string,
					"width": number,
					"height": number
				}
			}
		*/
		const thumbVideo = vod.snippet.thumbnails.standard.url;
		const guild = client.guilds.cache.get(config["DISCORD"]["GUILD_ID"]);
		const channelDisc = guild.channels.cache.get(config["DISCORD"]["CHANNELS"]["VOD"]);
		const exampleEmbed = new EmbedBuilder()
			.setColor(0xB07705)
			.setTitle(vod.snippet.title)
			.setURL(config["URL"]["YOUTUBE"]["GET_VIDEO_PREFIX"] + vod.id)
			.setAuthor({ name: channel.display_name, iconURL: channel.thumbnail_url, url: 'https://www.twitch.tv/syneliasan' })
			.setDescription(vod.snippet.description.length ? vod.snippet.description : "Aucune description")
			.setThumbnail(channel.thumbnail_url)
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
		const creator = await twitch.getUserById(clip.creator_id);
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
	setInterval(twitchChecker, 10000);
	setInterval(youtubeChecker, 300000);
	setInterval(twitchChatChecker, 60000);
});

client.on(Events.InteractionCreate, async interaction => {
	if(interaction.isChatInputCommand()) return commandsHandler(interaction);
	if(interaction.isModalSubmit()) return modalSubmitHandler(interaction);
});

client.login(process.env.DISCORD_BOT_TOKEN);

registerCommands();