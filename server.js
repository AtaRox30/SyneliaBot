require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, Events } = require('discord.js');
const twitch = require('./twitch');
const commandsManager = require('./deploy-commands');
const config = require('./config.json');
const clips_vods = require('./clips-vods.json');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

var worker = null;
const commands = commandsManager.commands;
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

const keepAlive = () => {
	let count = 0;
	setInterval(() => {
		axios.get(process.env.URL_FETCH).then(() => {
			console.log(`[${++count}] My ping is the following ${process.env.URL_FETCH}`);
		})
	}, 300000);
}

const thread = async () => {
	const channel = await checkStream();
	await checkVODS(channel);
	await checkClips(channel);
};

const checkStream = async () => {
	const channel = await twitch.getChannel();
	if(!config["IS_LIVE"] && channel.is_live)
	{
		//Streamer wasn't streaming the last time we checked, but is streaming now, so we send
		notifyStream(channel);
	}
	config["IS_LIVE"] = channel.is_live;
	fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
	return channel;
}

const checkVODS = async (channel) => {
	const aVods = await twitch.getVODS();
	const aNotified = aVods.filter(v => !clips_vods["VODS"].includes(v.id)).sort((a, b) => new Date(a.created_at) < new Date(b.created_at)).reverse();
	if(aNotified.length)
	{
		//At least one video found, notify
		notifyVods(channel, aNotified);
	}
	clips_vods["VODS"] = aVods.map(v => v.id);
	fs.writeFileSync("./clips-vods.json", JSON.stringify(clips_vods, null, 4));
}

const checkClips = async (channel) => {
	const aClips = await twitch.getClips();
	const aNotified = aClips.filter(v => !clips_vods["CLIPS"].includes(v.id)).sort((a, b) => new Date(a.created_at) < new Date(b.created_at)).reverse();
	if(aNotified.length)
	{
		//At least one video found, notify
		notifyClips(channel, aNotified);
	}
	clips_vods["CLIPS"] = aClips.map(v => v.id);
	fs.writeFileSync("./clips-vods.json", JSON.stringify(clips_vods, null, 4));
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
	worker = setInterval(thread, 10000);
});

client.on(Events.InteractionCreate, async interaction => {
	if(interaction.isChatInputCommand()) return commandsHandler(interaction);
	if(interaction.isModalSubmit()) return modalSubmitHandler(interaction);
});

client.login(process.env.DISCORD_BOT_TOKEN);

keepAlive();
registerCommands();