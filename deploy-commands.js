const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
// const Jimp = require('jimp');
const twitch = require('./twitch');
const mongo = require('./mongo');
const comfy = require('./comfy');

const sendToAuthor = async (client, interaction, messageObject) => {
	const user = interaction.user;
	const guild = client.guilds.cache.get(interaction.guildId);
	await guild.members.cache.get(user.id).send(messageObject);
}

const insertOrUpdateDrinker = async (discordId, name) => {
	const drinker = await mongo.getDrinkerProfile({ "discordId" : discordId });
	if(drinker)
	{
		await mongo.updateDrinkerProfile(
			{ "discordId" : discordId },
			{
				"$set": { "twitchId" : name }
			}
		);
	}
	else
	{
		await mongo.insertDrinkerProfile(discordId, name);
	}
}

// function fill(color) {
//     return function (x, y, offset) {
//       this.bitmap.data.writeUInt32BE(color, offset, true);
//     }
// }

// const buildIngredientsRecapImage = async (userId) => {
// 	let width = 205;
//     let height = 30 + 5 * 20;
// 	return new Promise((res, rej) => {
// 		new Jimp(width, height, "white", async function(err, image) {
// 			if(err) rej(err);
// 			const font = await Jimp.loadFont(Jimp.FONT_SANS_12_BLACK);
// 			image.print(font, 20, 2, "Rang");
// 			image.print(font, 70, 2, "Pseudo");
// 			image.print(font, 150, 2, "Points");
// 			image.scan(0, 20, width, 1, fill("black"));
// 			let y = 25;
// 			for(let i = 0; i < 5; i++) {
// 				image.print(font, 30, y, "1000");
// 				image.print(font, 70, y, "1000");
// 				image.print(font, 165, y, "1000");
// 				y += 20;
// 			}
	
// 			await image.writeAsync("./classement.png");
// 			res(true);
// 		});
// 	});
// }

const S4 = () => {return (((1+Math.random())*0x10000)|0).toString(16).substring(1)};

const data = {
	"commands": [
		// Link Twitch account
		{
			data: new SlashCommandBuilder().setName('link').setDescription('Lie votre compte Twitch à Discord')
				.addStringOption(option => option.setName('twitch-account').setDescription('Le compte Twitch').setRequired(true)),
			execute: async (client, interaction) => {
				const accountName = interaction.options.get('twitch-account').value;
				const userTwitch = await twitch.getUserByName(accountName);
				const code = S4().toUpperCase();
				const embedVerif = new EmbedBuilder()
					.setColor(0x3B5998)
					.setAuthor({ name: userTwitch.display_name, iconURL: userTwitch.profile_image_url, url: `https://www.twitch.tv/${userTwitch.login}` })
					.setTitle("Requête de liaison du compte Twitch")
					.setURL(`https://www.twitch.tv/${userTwitch.login}`)
					.setDescription("Veuillez rentrer le code suivant dans le chat Twitch de votre compte : " + code)
					.setThumbnail("https://cdn4.iconfinder.com/data/icons/colorful-design-basic-icons-1/550/question_doubt_darkblue-512.png");

				sendToAuthor(client, interaction, {
					content: "",
					embeds: [embedVerif]
				});

				const chatSession = setTimeout(() => {
					comfy.close();
					const embedMiss = new EmbedBuilder()
						.setColor(0xDD3333)
						.setAuthor({ name: userTwitch.display_name, iconURL: userTwitch.profile_image_url, url: `https://www.twitch.tv/${userTwitch.login}` })
						.setTitle("Délai d'attente dépassé")
						.setDescription("Vous n'avez pas rentrer le code ou nous n'avons pas reussi à le lire, si tel est le cas, en avertir le staff")
						.setThumbnail("https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Cross_red_circle.svg/2048px-Cross_red_circle.svg.png");
					sendToAuthor(client, interaction, {
						content: "",
						embeds: [embedMiss]
					});
				}, 120000);

				comfy.listen(accountName, async (user, message, flags, self, extra) => {
					if(message === code && user === extra.displayName)
					{
						const embedConfirm = new EmbedBuilder()
							.setColor(0x43A047)
							.setAuthor({ name: userTwitch.display_name, iconURL: userTwitch.profile_image_url, url: `https://www.twitch.tv/${extra.channel}` })
							.setTitle("Confirmation du compte Twitch")
							.setURL(`https://www.twitch.tv/${extra.channel}`)
							.setDescription(`Le compte ${userTwitch.display_name} a été lié à votre compte Discord`)
							.setThumbnail("https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Eo_circle_green_checkmark.svg/1200px-Eo_circle_green_checkmark.svg.png");

						sendToAuthor(client, interaction, {
							content: "",
							embeds: [embedConfirm]
						});
						clearTimeout(chatSession);
						comfy.close();

						insertOrUpdateDrinker(interaction.user.id, extra.channel);
					}
				});
				await interaction.reply({ content: 'Un message vous a été envoyé', ephemeral: true });
			},
		},
		// // View ingredients in stocks
		// {
		// 	data: new SlashCommandBuilder().setName('ingredients').setDescription('Consultation des ingredients en votre possession'),
		// 	execute: async (client, interaction) => {
		// 		await buildIngredientsRecapImage(interaction.user.id);
		// 		await sendToAuthor(client, interaction, {
		// 			content: "Voici les ingredients en votre possession",
		// 			files: ["./classement.png"]
		// 		});
		// 		fs.unlink("./classement.png", function() {});
		// 		await interaction.reply({ content: 'Vos ingredients vous ont été envoyés en privé', ephemeral: true });
		// 	},
		// },
		// // View recipes
		// {
		// 	data: new SlashCommandBuilder().setName('recipes').setDescription('Consultation des recettes disponible'),
		// 	execute: async (client, interaction) => {
		// 		await interaction.reply({ content: 'Vos ingredients vous ont été envoyés en privé', ephemeral: true });
		// 	},
		// },
		// // Infuse
		// {
		// 	data: new SlashCommandBuilder().setName('infusion').setDescription('Infusion d\'un thé avec vos ingredients'),
		// 	execute: async (client, interaction) => {
		// 		await interaction.reply({ content: 'La commande est en travaux !', ephemeral: true });
		// 	},
		// },
		// Set up stream alert
		{
			data: new SlashCommandBuilder().setName('setup-stream').setDescription('Paramètrage des alertes de live'),
			execute: async (client, interaction) => {
				const user = interaction.user;
				const guild = client.guilds.cache.get(interaction.guildId);
				const member = guild.members.cache.get(user.id);
				// Rôle modérateur → 1044662246544003176
				const hasModRole = member.roles.cache.find(r => r.id === "866285918070898719") || user.id === "236174876933619713";
				if(!hasModRole)
				{
					await interaction.reply(
						{
							content: "Tu manques de permission mon jeune ami !",
							ephemeral: true
						}
					);
					return
				}

				const storedAlert = (await mongo.getGlobalInfo()).stream_alert_message;

				const modal = new ModalBuilder()
					.setCustomId('setup-stream')
					.setTitle('Alerte de stream');

				// Create color picker
				const color = new TextInputBuilder()
					.setCustomId('COLOR')
					// The label is the prompt the user sees for this input
					.setLabel("Code couleur héxadécimal du message")
					.setPlaceholder("FF0000")
					.setValue(storedAlert.color.slice(2))
					// Short means only a single line of text
					.setStyle(TextInputStyle.Short);

				// Create title
				const title = new TextInputBuilder()
					.setCustomId('TITLE')
					// The label is the prompt the user sees for this input
					.setLabel("Titre")
					.setPlaceholder("$NOM est en stream !")
					.setValue(storedAlert.title)
					// Short means only a single line of text
					.setStyle(TextInputStyle.Short);

				// Create description
				const description = new TextInputBuilder()
					.setCustomId('DESCRIPTION')
					.setLabel("Description")
					.setPlaceholder("[$JEU] $TITLE")
					.setValue(storedAlert.description)
					// Paragraph means multiple lines of text.
					.setStyle(TextInputStyle.Paragraph);

				// Create thumbnail
				const thumbnail = new TextInputBuilder()
					.setCustomId('THUMBNAIL')
					// The label is the prompt the user sees for this input
					.setLabel("URL de la miniature")
					.setPlaceholder("$IMG")
					.setValue(storedAlert.thumbnail)
					// Short means only a single line of text
					.setStyle(TextInputStyle.Short);

				// An action row only holds one text input,
				// so you need one action row per text input.
				const firstActionRow = new ActionRowBuilder().addComponents(color);
				const secondActionRow = new ActionRowBuilder().addComponents(title);
				const thirdActionRow = new ActionRowBuilder().addComponents(description);
				const fourthActionRow = new ActionRowBuilder().addComponents(thumbnail);

				modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

				await interaction.showModal(modal);
			},
			submit: async (interaction) => {
				const channel = await twitch.getChannel();
				const replaceEnv = (string) => string.replace("$TITRE", channel.title)
					.replace("$IMG", channel.thumbnail_url)
					.replace("$NOM", channel.display_name)
					.replace("$JEU", channel.game_name);
				const color = interaction.fields.getTextInputValue('COLOR');
				const title = interaction.fields.getTextInputValue('TITLE');
				const description = interaction.fields.getTextInputValue('DESCRIPTION');
				const thumbnail = interaction.fields.getTextInputValue('THUMBNAIL');

				const replyBadColor = async (color) => {
					await interaction.reply({
						content: 'Le code hexadécimal de la couleur est incorrecte ' + (color),
						ephemeral: true
					});
				}

				const replyBadURL = async (url) => {
					await interaction.reply({
						content: 'L\'URL est mal formée ' + url,
						ephemeral: true
					});
				}

				const matchColor = replaceEnv(color).toUpperCase().match("([A-F0-9]+)");
				if(matchColor)
				{
					if(matchColor[0].length !== 6) return replyBadColor(replaceEnv(color));
				}
				else return replyBadColor(replaceEnv(color));

				const regexUrl = "(https?:\\/\\/(?:www\\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\\.[^\\s]{2,}|www\\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\\.[^\\s]{2,}|https?:\\/\\/(?:www\\.|(?!www))[a-zA-Z0-9]+\\.[^\\s]{2,}|www\\.[a-zA-Z0-9]+\\.[^\\s]{2,})";
				const matchUrl = replaceEnv(thumbnail).match(regexUrl);
				if(matchUrl)
				{
					if(matchUrl[0].length !== replaceEnv(thumbnail).length) return replyBadURL(replaceEnv(thumbnail));
				}
				else return replyBadURL(replaceEnv(thumbnail));

				mongo.setGlobalInfo({ "$set" : 
					{ 
						"stream_alert_message" : {
							color: "0x" + color,
							title: title,
							description: description,
							thumbnail: thumbnail
						}
					}
				});

				const embed = new EmbedBuilder()
					.setColor(replaceEnv("0x" + color))
					.setTitle(replaceEnv(title))
					.setURL('https://www.twitch.tv/syneliasan')
					.setAuthor({ name: channel.display_name, iconURL: channel.thumbnail_url, url: 'https://www.twitch.tv/syneliasan' })
					.setDescription(replaceEnv(description))
					.setThumbnail(replaceEnv(thumbnail))
				
				await interaction.reply({
					content: 'Les paramètres d\'alerte ont été modifiés ! Voici l\'aperçu.\n' + 
					'(Tu peux utiliser les variables $TITRE (Titre du stream), $IMG (Image de profil), $NOM (Pseudo du streamer), $JEU (Nom du jeu))',
					embeds: [embed],
					ephemeral: true
				});
			}
		}
	]
};

module.exports = data;