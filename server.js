require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder, Presence, Collection, Interaction } = require('discord.js');
const twitch = require('./twitch');
const config = require('./config.json');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

var worker = null;

const keepAlive = () => {
	let count = 0;
	setInterval(() => {
		require('node-fetch')(process.env.URL_FETCH).then(() => {
			console.log(`[${++count}] My ping is the following ${process.env.URL_FETCH}`);
		})
	}, 300000)
}

const thread = async () => {
	const channel = await checkStream();
	await checkVODS(channel);
	await checkClips(channel);
	const utcNow = new Date().toUTCString();
	config["LAST_CHECKED"] = new Date(utcNow).toISOString();
	fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
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
	const aNotified = aVods.filter(v => new Date(v.published_at) > new Date(config["LAST_CHECKED"]));
	if(aNotified.length)
	{
		//At least one video found, notify
		notifyVods(channel, aNotified);
	}
}

const checkClips = async (channel) => {
	const aClips = await twitch.getClips();
	const aNotified = aClips.filter(v => new Date(v.created_at) > new Date(config["LAST_CHECKED"]));
	if(aNotified.length)
	{
		//At least one video found, notify
		notifyClips(channel, aNotified);
	}
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
	const guild = client.guilds.cache.get(config["DISCORD"]["GUILD_ID"]);
	const channelDisc = guild.channels.cache.get(config["DISCORD"]["CHANNELS"]["ONLINE"]);
	const exampleEmbed = new EmbedBuilder()
		.setColor(0xB00514)
		.setTitle(channel.display_name + " est en stream !")
		.setURL('https://www.twitch.tv/syneliasan')
		.setAuthor({ name: channel.display_name, iconURL: channel.thumbnail_url, url: 'https://www.twitch.tv/syneliasan' })
		.setDescription(channel.title)
		.setThumbnail(channel.thumbnail_url)

	channelDisc.send({
		content: '@everyone',
		embeds: [exampleEmbed]
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

		channelDisc.send({
			content: '@everyone',
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

		channelDisc.send({
			content: '@everyone',
			embeds: [exampleEmbed]
		});
	});
}

client.on("ready", async () => {
    console.log("Discord bot ready");
	worker = setInterval(thread, 10000);
});

client.login(process.env.DISCORD_BOT_TOKEN);

keepAlive();