require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, Events } = require('discord.js');
const twitch = require('./twitch');
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
	await checkClips(await checkStream());
	setTimeout(twitchChecker, 10000);
};

const twitchChatChecker = async () => {
	const channel = await twitch.getChannel();
	if(channel.is_live)
	{
		const worthDrinker = await distributePoint();
		const aToNotify = await distributeIngredient(worthDrinker);
		notifyIngredientGot(aToNotify);
	}
	setTimeout(twitchChatChecker, 60000);
};

const checkStream = async () => {
	const channel = await twitch.getChannel();
	const info = await mongo.getGlobalInfo();
	if(!info.is_live && channel.is_live)
	{
		//Streamer wasn't streaming the last time we checked, but is streaming now, so we send
		notifyStream(channel);
	}
	if(info.is_live && !channel.is_live)
	{
		//Streamer was streaming the last time we checked, but is not streaming now, so we remove the alert
		deleteStreamNotification(info.current_message_alert_id);
	}
	mongo.setGlobalInfo({ "$set" : { "is_live" : channel.is_live } });
	return channel;
}

const checkClips = async (channel) => {
	try {
		const aClips = await twitch.getClips();
		const aVideosFromPromises = [];
		aClips.filter(v => v.video_id.length > 0).forEach(v => aVideosFromPromises.push(twitch.getVideoById(v.video_id)));
		const aVideosInfos = await Promise.all(aVideosFromPromises).then(() => Promise.all(aVideosFromPromises));
		const info = await mongo.getGlobalInfo();
		const aNotified = aClips.filter(v => !info.clips.includes(v.id))
			.filter(v => !aVideosInfos.map(v => v.title).includes(v.title)).sort((a, b) => new Date(a.created_at) < new Date(b.created_at)).reverse();
		if(aNotified.length)
		{
			//At least one video found, notify
			notifyClips(channel, aNotified);
		}
		const aNotPublished = aClips.filter(c => aVideosInfos.map(v => v.title).includes(c.title)).filter(v => !info.clips.includes(v.id)).map(v => v.id);
		const aToPush = aNotified.map(v => v.id);
		aToPush.push(...aNotPublished);
		mongo.setGlobalInfo(
			{ "$push" : { "clips" : { "$each" : aToPush } } },
			{ "upsert" : true }
		);
	} catch(e) {
		console.log('Caught exception in : checkClips');
		console.log(e);
	}
}

const distributePoint = async () => {
	const chatters = await twitch.getChatters();
	const drinkers = await mongo.getDrinkers();
	const ret = [];
	for(const chatter of chatters)
	{
		const drinker = drinkers.filter(v => v.twitchId === chatter);
		if(!drinker.length) continue
		await mongo.incrementPoints(drinker[0].twitchId, drinker[0].points);
		if(drinker[0].points >= 19) ret.push(drinker[0]);
	}
	return ret;
}

const distributeIngredient = async (worthDrinkers) => {
	const notifier = [];
	for(const v of worthDrinkers)
	{
		let haveAmount = true;
		const ingredient = getRandomIngredient();
		const currentIngredientStat = v.ingredients.filter(v => v.code === ingredient);
		if(currentIngredientStat.length === 0)
		{
			await mongo.insertIngredientProfile({ "twitchId" : v.twitchId }, ingredient);
			haveAmount = false;
		}
		await mongo.resetPointFromDrinker({ "twitchId" : v.twitchId });
		await mongo.incrementAmount(v.twitchId, ingredient, (haveAmount ? currentIngredientStat[0].amount : 0));
		notifier.push({ "twitchId": v.twitchId, "ingredient": ingredient });
	}
	return notifier;
}

const getRandomIngredient = () => {
	const drop = Math.random();
	const dRate = {
		"COMMON": 0.4,
		"RARE": 0.3,
		"EPIC": 0.15,
		"LEGENDARY": 0.10,
		"MYTHICAL": 0.05,
	};
	const cumul = {
		"COMMON": 1 - dRate.COMMON,
		"RARE": 1 - dRate.COMMON - dRate.RARE,
		"EPIC": 1 - dRate.COMMON - dRate.RARE - dRate.EPIC,
		"LEGENDARY": 1 - dRate.COMMON - dRate.RARE - dRate.EPIC - dRate.LEGENDARY,
		"MYTHICAL": 1 - dRate.COMMON - dRate.RARE - dRate.EPIC - dRate.LEGENDARY - dRate.MYTHICAL
	};
	const rank = drop > cumul.COMMON ? "COMMON" : 
		drop > cumul.RARE ? "RARE" : 
		drop > cumul.EPIC ? "EPIC" : 
		drop > cumul.LEGENDARY ? "LEGENDARY" : 
		"MYTHICAL";
	/**
	 * DROP
	 * COMMON : 40%
	 * RARE : 30%
	 * EPIC : 15%
	 * LEGENDARY : 10%
	 * MYTHICAL : 5%
	 * 
	 * INGREDIENT VALUE
	 * 5(1 - %drop) x (1 - 1/%ingredientInCat)
	 * e.g. Fraise → 5(1 - 0.6) * (1 - 1/7) = 2 * 0.85 = 1.7
	 * e.g. Bergamotte → 5(1 - 0.1) * (1 - 1/4) = 4.5 * 0.75 = 3.375
	 * e.g. Carthame → 5(1 - 0.05) * (1 - 1/3) = 4.75 * 0.66 = 3.135
	 */
	const toGive = Object.entries(ingredients).filter(v => v[1].rank === rank).map(v => v[0]);
	const ingredient = toGive[Math.floor(Math.random() * toGive.length)];
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

	const guild = client.guilds.cache.get(config["DISCORD"][process.env.PROFILE.toUpperCase()]["GUILD_ID"]);
	const channelDisc = guild.channels.cache.get(config["DISCORD"][process.env.PROFILE.toUpperCase()]["CHANNELS"]["ONLINE"]);
	const embed = new EmbedBuilder()
		.setColor(replaceEnv(storedAlert.color))
		.setTitle(replaceEnv(storedAlert.title))
		.setURL('https://www.twitch.tv/syneliasan')
		.setAuthor({ name: channel.display_name, iconURL: channel.thumbnail_url, url: 'https://www.twitch.tv/syneliasan' })
		.setDescription(replaceEnv(storedAlert.description))
		.setThumbnail(replaceEnv(storedAlert.thumbnail))

	const message = await channelDisc.send({
		content: '@everyone',
		embeds: [embed]
	});

	mongo.setGlobalInfo({ "$set" : { "current_message_alert_id" : message.id } });
}

const deleteStreamNotification = async (message_id) => {
	const guild = client.guilds.cache.get(config["DISCORD"][process.env.PROFILE.toUpperCase()]["GUILD_ID"]);
	const channelDisc = guild.channels.cache.get(config["DISCORD"][process.env.PROFILE.toUpperCase()]["CHANNELS"]["ONLINE"]);
	channelDisc.messages.fetch(message_id).then(msg => msg.delete());

	mongo.setGlobalInfo({ "$set" : { "current_message_alert_id" : "" } });
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
		const guild = client.guilds.cache.get(config["DISCORD"][process.env.PROFILE.toUpperCase()]["GUILD_ID"]);
		const channelDisc = guild.channels.cache.get(config["DISCORD"][process.env.PROFILE.toUpperCase()]["CHANNELS"]["CLIPS"]);
		const exampleEmbed = new EmbedBuilder()
			.setColor(0x4A9428)
			.setTitle(clip.title)
			.setURL(clip.url)
			.setAuthor({ name: clip.creator_name, iconURL: creator.profile_image_url })
			.setThumbnail(thumbGame)
			.setImage(thumbVideo)

		await channelDisc.send({
			content: clip.url,
			embeds: [exampleEmbed]
		});
	});
}

const notifyIngredientGot = (aToNotify) => {
	const colors = [
		{ rank: "COMMON", color: 0x75AD57 },
		{ rank: "RARE", color: 0x53A9E9 },
		{ rank: "EPIC", color: 0xA68BD1 },
		{ rank: "LEGENDARY", color: 0xEE8D0C },
		{ rank: "MYTHICAL", color: 0xD82D42 }
	];
	aToNotify.forEach(async drinker => {
		const drinkerProfile = await mongo.getDrinkerProfile({ "twitchId" : drinker.twitchId });
		const currentAmount = drinkerProfile.ingredients.filter(i => i.code === drinker.ingredient);
		const ingrName = ingredients[drinker.ingredient].name;
		const description = currentAmount.length === 0 ? `Vous récoltez votre premier(ère) ${ingrName} !` : `Vous récoltez votre ${currentAmount[0].amount}ème ${ingrName} !`;

		const guild = client.guilds.cache.get(config["DISCORD"][process.env.PROFILE.toUpperCase()]["GUILD_ID"]);
		const member = await guild.members.fetch(drinkerProfile.discordId);
		const channelDisc = guild.channels.cache.get(config["DISCORD"][process.env.PROFILE.toUpperCase()]["CHANNELS"]["HARVEST_TEA"]);

		const exampleEmbed = new EmbedBuilder()
			.setColor(colors.filter(v => v.rank === ingredients[drinker.ingredient].rank)[0].color)
			.setTitle("Vous avez récolté : " + ingredients[drinker.ingredient].name)
			.setAuthor({ name: member.user.username, iconURL: member.user.avatarURL() })
			.setThumbnail("attachment://ingredient.png")
			.setDescription(description)
			.setTimestamp()

		await channelDisc.send({
			content: `<@${drinkerProfile.discordId}>`,
			embeds: [exampleEmbed],
			files: [{
				attachment: ingredients[drinker.ingredient].url.main.filter(v => Math.random() < v.probability)[0].url,
        		name: 'ingredient.png'
			}]
		});
	});
}

const registerCommands = () => {
	(async () => {
		try {
			console.log(`Started refreshing ${commands.length} application (/) commands.`);
	
			// The put method is used to fully refresh all commands in the guild with the current set
			const data = await rest.put(
				Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, config["DISCORD"][process.env.PROFILE.toUpperCase()]["GUILD_ID"]),
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
	const command = commands.filter(v => v.data.name === interaction.customId.substring(0, v.data.name.length));

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

const buttonsHandler = async (interaction) => {
	const command = commands.filter(v => v.data.name === interaction.customId.substring(0, v.data.name.length));

	if (!command.length) {
		console.error(`No button matching ${interaction.customId} was found.`);
		return;
	}

	try {
		await command[0].click(client, interaction);
	} catch (error) {
		console.error(`Error executing ${interaction.customId}`);
		console.error(error);
	}
}

const autocompletesHandler = async (interaction) => {
	const command = commands.filter(v => v.data.name === interaction.commandName);

	if (!command.length) {
		console.error(`No autocomplete matching ${interaction.customId} was found.`);
		return;
	}

	try {
		await command[0].autocomplete(client, interaction);
	} catch (error) {
		console.error(`Error executing ${interaction.customId}`);
		console.error(error);
	}
}

client.on("ready", async () => {
	if(process.env.PROFILE === "dev")
	{
		client.user.setPresence({
			status: 'idle',
			activities: [
				{
					name: "Maintenance"
				}
			]
		});
	}
    console.log("Discord bot ready");
	twitchChecker();
	twitchChatChecker();
});

client.on(Events.InteractionCreate, async interaction => {
	if(interaction.isChatInputCommand()) return commandsHandler(interaction);
	if(interaction.isModalSubmit()) return modalSubmitHandler(interaction);
	if(interaction.isButton()) return buttonsHandler(interaction);
	if(interaction.isAutocomplete()) return autocompletesHandler(interaction);
});

client.login(process.env.DISCORD_BOT_TOKEN);

registerCommands();