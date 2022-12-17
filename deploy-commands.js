const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const config = require('./config.json');
const fs = require('fs');
const twitch = require('./twitch');

const sendToAuthor = (client, interaction, messageObject) => {
	const user = interaction.user;
	const guild = client.guilds.cache.get(interaction.guildId);
	guild.members.cache.get(user.id).send(messageObject)
}

const data = {
	"commands": [
		// Link Twitch account
		{
			data: new SlashCommandBuilder().setName('link').setDescription('Lie votre compte Twitch à Discord'),
			execute: async (client, interaction) => {
				// sendToAuthor(client, interaction, "test");
				await interaction.reply({ content: 'La commande est en travaux !', ephemeral: true });
			},
		},
		// View recipes
		{
			data: new SlashCommandBuilder().setName('recipes').setDescription('Consultation des recettes disponible'),
			execute: async (client, interaction) => {
				await interaction.reply({ content: 'La commande est en travaux !', ephemeral: true });
			},
		},
		// View ingredients in stocks
		{
			data: new SlashCommandBuilder().setName('ingredients').setDescription('Consultation des ingredients en votre possession'),
			execute: async (client, interaction) => {
				await interaction.reply({ content: 'La commande est en travaux !', ephemeral: true });
			},
		},
		// Infuse
		{
			data: new SlashCommandBuilder().setName('infusion').setDescription('Infusion d\'un thé avec vos ingredients'),
			execute: async (client, interaction) => {
				await interaction.reply({ content: 'La commande est en travaux !', ephemeral: true });
			},
		},
		// Set up stream alert
		{
			data: new SlashCommandBuilder().setName('setup-stream').setDescription('Paramètrage des alertes de live'),
			execute: async (client, interaction) => {
				const user = interaction.user;
				const guild = client.guilds.cache.get(interaction.guildId);
				const member = guild.members.cache.get(user.id);
				// Rôle modérateur → 1044662246544003176
				const hasModRole = member.roles.cache.find(r => r.id === "866285918070898719");
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

				const modal = new ModalBuilder()
					.setCustomId('setup-stream')
					.setTitle('Alerte de stream');

				// Create color picker
				const color = new TextInputBuilder()
					.setCustomId('COLOR')
					// The label is the prompt the user sees for this input
					.setLabel("Couleur HEX du message d'alerte")
					.setPlaceholder("FF0000")
					// Short means only a single line of text
					.setStyle(TextInputStyle.Short);

				// Create title
				const title = new TextInputBuilder()
					.setCustomId('TITLE')
					// The label is the prompt the user sees for this input
					.setLabel("Titre de l'alerte")
					.setPlaceholder("{{ CHANNEL_DISPLAY_NAME }} est en stream !")
					// Short means only a single line of text
					.setStyle(TextInputStyle.Short);

				// Create description
				const description = new TextInputBuilder()
					.setCustomId('DESCRIPTION')
					.setLabel("Description de l'alerte")
					.setPlaceholder("{{ CHANNEL_TITLE }}")
					// Paragraph means multiple lines of text.
					.setStyle(TextInputStyle.Paragraph);

				// Create thumbnail
				const thumbnail = new TextInputBuilder()
					.setCustomId('THUMBNAIL')
					// The label is the prompt the user sees for this input
					.setLabel("URL de la miniature de l'alerte")
					.setPlaceholder("https://cdn.discordapp.com/attachments/709110645966110751/1053253703718686790/happy_ducky_.png")
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

				config["STREAM_ALERT_MESSAGE"]["COLOR"] = "0x" + color;
				config["STREAM_ALERT_MESSAGE"]["DESCRIPTION"] = description;
				config["STREAM_ALERT_MESSAGE"]["THUMBNAIL"] = thumbnail;
				config["STREAM_ALERT_MESSAGE"]["TITLE"] = title;
				fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));

				const embed = new EmbedBuilder()
					.setColor(replaceEnv("0x" + color))
					.setTitle(replaceEnv(title))
					.setURL('https://www.twitch.tv/syneliasan')
					.setAuthor({ name: channel.display_name, iconURL: channel.thumbnail_url, url: 'https://www.twitch.tv/syneliasan' })
					.setDescription(replaceEnv(description))
					.setThumbnail(replaceEnv(thumbnail))
				
				await interaction.reply({
					content: 'Les paramètres d\'alerte ont été modifiés ! Voici l\'aperçu de l\'alerte.\n' + 
					'(Tu peux utiliser les variables $TITRE (Titre du stream), $IMG (Image de profil), $NOM (Pseudo du streamer), $JEU (Nom du jeu))',
					embeds: [embed],
					ephemeral: true
				});
			}
		}
	]
};

module.exports = data;