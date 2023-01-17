const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonStyle, ButtonBuilder } = require('discord.js');
const fs = require('fs');
const twitch = require('./twitch');
const tools = require('./teaTools');
const mongo = require('./mongo');
const comfy = require('./comfy');
const recipes = require('./recipes.json');
const ingredients = require('./ingredients.json');

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

const buildEmbedIngredientsRecap = async (userId, page) => {
	return new Promise(async (res, rej) => {
		const drinker = await mongo.getDrinkerProfile({ "discordId" : userId });
		if(!drinker)
		{
			return rej({ success: false, error: 'NO_DRINKER' });
		}
		const url = [];
		drinker.ingredients.slice((page - 1) * 9, page * 9).forEach(v => url.push(tools.buildBasket(v.code, v.amount)));
		Promise.all(url).then(() => Promise.all(url))
		.then(async (data) => {
			const store = await tools.buildIngredientsStore(...data);

			const embedVerif = new EmbedBuilder()
				.setColor(0x3B5998)
				.setTitle(`Entrepôt (Page ${page})`)
				.setDescription("Ingredients en votre possession")
				.setImage("attachment://store.png");
			
			const comps = [];
			if(page > 1) comps.push(new ButtonBuilder().setCustomId('ingredients-previous').setLabel('Précédant').setStyle(ButtonStyle.Secondary));
			if(page < drinker.ingredients.length / 9) comps.push(new ButtonBuilder().setCustomId('ingredients-next').setLabel('Suivant').setStyle(ButtonStyle.Secondary));
			const row = new ActionRowBuilder().addComponents(...comps);
			res({ success: true, embed: embedVerif, store: store, links: data, row: row, pagination: comps.length > 0 });
		})
		.catch(e => rej({ success: false, error: 'PROMISE_REJECTION', message: e }))
	})
}

const buildEmbedRecipeRecap = async (userId, page) => {
	return new Promise(async (res, rej) => {
		const drinker = await mongo.getDrinkerProfile({ "discordId" : userId });
		if(!drinker)
		{
			return rej({ success: false, error: 'NO_DRINKER' });
		}
		const url = [];
		Object.entries(recipes).slice((page - 1) * 5, page * 5).forEach(v => url.push(tools.buildTea(v[1].ingredients)));
		Promise.all(url).then(() => Promise.all(url))
		.then(async (data) => {
			const recipesInfos = Object.entries(recipes).map(v => v[1]).slice((page - 1) * 5, page * 5)
			const store = await tools.buildRecipesStore(data, recipesInfos);

			const embedVerif = new EmbedBuilder()
				.setColor(0x3B5998)
				.setTitle(`Entrepôt (Page ${page})`)
				.setDescription("Recettes disponible")
				.setImage("attachment://store.png");
			
			const comps = [];
			if(page > 1) comps.push(new ButtonBuilder().setCustomId('recipes-previous').setLabel('Précédant').setStyle(ButtonStyle.Secondary));
			if(page < Object.keys(recipes).length / 5) comps.push(new ButtonBuilder().setCustomId('recipes-next').setLabel('Suivant').setStyle(ButtonStyle.Secondary));
			const row = new ActionRowBuilder().addComponents(...comps);
			res({ success: true, embed: embedVerif, store: store, links: data, row: row, pagination: comps.length > 0 });
		})
		.catch(e => rej({ success: false, error: 'PROMISE_REJECTION', message: e }))
	})
}

const buildRecipeRecapString = async (client, userId) => {
	return new Promise(async (res, rej) => {
		const drinker = await mongo.getDrinkerProfile({ "discordId" : userId });
		if(!drinker)
		{
			return rej({ success: false, error: 'NO_DRINKER' });
		}
		let content = '';
		const contents = [];
		const check = '<:green_square:1064956827042840637>';
		const uncheck = '<:red_square:1064956714086060172>';
		let charactersLen = 0;
		let isFinishedOnAdd = false;
		const formedObject = {};
		drinker.ingredients.forEach(v => formedObject[v.code] = v.amount);
		const availableRecipes = tools.getAvailableRecipes(formedObject);
		Object.entries(recipes).forEach(v => {
			isFinishedOnAdd = false;
			// :white_check_mark: [Anastasia] (3 XP) - 1 Vanille, 2 Violette, 1 Menthe
			let ingr = '';
			let isAvailable = false;
			availableRecipes.filter(ar => ar[0] === v[0]).length ? isAvailable = true : '';
			const tmpObj = {};
			Object.entries(v[1].ingredients).forEach(i => {
				ingr += ` - ${i[1]} ${ingredients[i[0]].name}`;
				tmpObj[i[0]] = i[1];
			});
			const mess = `${isAvailable ? check : uncheck} [${v[1].name}] (${tools.getXP(tmpObj)} XP)${ingr}\n`;
			const isNotOkToAdd = charactersLen + mess.length > 2000;
			if(isNotOkToAdd)
			{
				contents.push(content);
				content = '';
				charactersLen = 0;
				isFinishedOnAdd = true;
			}
			content += mess;
			charactersLen += mess.length;
		});
		if(!isFinishedOnAdd) contents.push(content);
		res({ success: true, content: contents });
	})
}

const S4 = () => {return (((1+Math.random())*0x10000)|0).toString(16).substring(1)};

const data = {
	"commands": [
		// Link Twitch account
		{
			data: new SlashCommandBuilder().setName('link').setDescription('Lie votre compte Twitch à Discord')
				.addStringOption(option => option.setName('twitch-account').setDescription('Le compte Twitch').setRequired(true)),
			execute: async (client, interaction) => {
				const accountName = interaction.options.get('twitch-account').value;
				let userTwitch = {};
				try {
					userTwitch = await twitch.getUserByName(accountName);
				} catch(e) {
					return await interaction.reply({ content: `L'utilisateur ${accountName} n'existe pas`, ephemeral: true });
				}
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
		// View ingredients in stocks
		{
			data: new SlashCommandBuilder().setName('ingredients').setDescription('Consultation des ingredients en votre possession'),
			execute: async (client, interaction) => {
				try {
					await interaction.deferReply({ ephemeral: true });
					const result = await buildEmbedIngredientsRecap(interaction.user.id, 1);
					const message = {
						content: "",
						components: [result.row],
						embeds: [result.embed],
						files: [{
							attachment: result.store,
							name: 'store.png'
						}]
					};
					if(!result.pagination) delete message.components;

					await sendToAuthor(client, interaction, message);

					result.links.forEach(v => fs.unlink(v, function() {}))
					fs.unlink(result.store, function() {});

					await interaction.followUp({ content: 'Vos ingredients vous ont été envoyés en privé', ephemeral: true });
				} catch(e) {
					if(e.error === 'NO_DRINKER')
					{
						await interaction.followUp({ content: 'Vous devez tout d\'abord lié votre compte Twitch à Discord grâce à la commande /link <pseudo_twitch>', ephemeral: true });
						return;
					} else console.log(e);
				}
			},
			click: async (client, interaction) => {
				await interaction.deferReply();
				const page = interaction.message.embeds[0].data.title.match('Page (\\d+)')[1];
				let newPage = 0;
				const actionType = interaction.customId.split('-')[1];
				try {
					if(actionType === 'previous') newPage = Number.parseInt(page) - 1;
					if(actionType === 'next') newPage = Number.parseInt(page) + 1;
					const result = await buildEmbedIngredientsRecap(interaction.user.id, newPage);
					const message = {
						content: "",
						components: [result.row],
						embeds: [result.embed],
						files: [{
							attachment: result.store,
							name: 'store.png'
						}]
					};
					if(!result.pagination) delete message.components;

					await interaction.followUp(message);

					result.links.forEach(v => fs.unlink(v, function() {}))
					fs.unlink(result.store, function() {});
				} catch(e) {
					if(e.error === 'NO_DRINKER')
					{
						await interaction.followUp({ content: 'Vous devez tout d\'abord lié votre compte Twitch à Discord grâce à la commande /link <pseudo_twitch>', ephemeral: true });
						return;
					} else console.log(e);
				}
			}
		},
		// View recipes
		{
			data: new SlashCommandBuilder().setName('recipes').setDescription('Consultation des recettes disponible'),
			execute: async (client, interaction) => {
				try {
					await interaction.deferReply({ ephemeral: true });
					
					const result = await buildRecipeRecapString(client, interaction.user.id);
					await result.content.forEach(async v => await sendToAuthor(client, interaction, { content:v, ephemeral: true }));

					await interaction.followUp({ content: 'Les recettes vous ont été envoyées en privée', ephemeral: true });
				} catch(e) {
					if(e.error === 'NO_DRINKER')
					{
						await interaction.followUp({ content: 'Vous devez tout d\'abord lié votre compte Twitch à Discord grâce à la commande /link <pseudo_twitch>', ephemeral: true });
						return;
					} else console.log(e);
				}
			},
			click: async (client, interaction) => {
				await interaction.deferReply();
				const page = interaction.message.embeds[0].data.title.match('Page (\\d+)')[1];
				let newPage = 0;
				const actionType = interaction.customId.split('-')[1];
				try {
					if(actionType === 'previous') newPage = Number.parseInt(page) - 1;
					if(actionType === 'next') newPage = Number.parseInt(page) + 1;
					const result = await buildEmbedRecipeRecap(interaction.user.id, newPage);
					const message = {
						content: "",
						components: [result.row],
						embeds: [result.embed],
						files: [{
							attachment: result.store,
							name: 'store.png'
						}]
					};
					if(!result.pagination) delete message.components;

					await interaction.followUp(message);

					result.links.forEach(v => fs.unlink(v, function() {}))
					fs.unlink(result.store, function() {});
				} catch(e) {
					if(e.error === 'NO_DRINKER')
					{
						await interaction.followUp({ content: 'Vous devez tout d\'abord lié votre compte Twitch à Discord grâce à la commande /link <pseudo_twitch>', ephemeral: true });
						return;
					} else console.log(e);
				}
			}
		},
		// Infuse
		{
			data: new SlashCommandBuilder().setName('infusion').setDescription('Infusion d\'un thé avec vos ingredients')
				.addStringOption(option => option.setName('infusion-recipe').setDescription('Nom de la recette à infuser').setRequired(true).setAutocomplete(true)),
			execute: async (client, interaction) => {
				const channel = await twitch.getChannel();
				if(!channel.is_live)
				{
					return await interaction.reply({ content: "Attends que ta streameuse préférée soit en live ! UwU", ephemeral: true });
				}

				const recipeKey = interaction.options.get('infusion-recipe').value;
				if(Object.keys(recipes).includes(recipeKey))
				{
					const user = await mongo.addRecipe(interaction.user.id, recipeKey, tools.getXP(recipes[recipeKey].ingredients));
					await mongo.retreiveIngredients(interaction.user.id, recipes[recipeKey].ingredients);

					const embed = new EmbedBuilder()
						.setColor(0x3B5998)
						.setTitle(recipes[recipeKey].name)
						.setDescription("Le temps d'infusion est de 5 minutes")
						.setThumbnail("attachment://theiere.gif");

					const message = {
						content: "",
						embeds: [embed],
						files: [{
							attachment: "./assets/theiere-anim.gif",
							name: 'theiere.gif'
						}],
						ephemeral: true
					};

					if(user.modifiedCount === 0) {
						message.content = "Vous devez tout d\'abord lié votre compte Twitch à Discord grâce à la commande /link <pseudo_twitch>";
						delete message.embeds;
						delete message.files;
					}

					await interaction.reply(message);
				} else {
					await interaction.reply({ content: "Ce thé n'existe pas !", ephemeral: true });
				}
				
			},
			autocomplete: async (client, interaction) => {
				const focusedValue = interaction.options.getFocused();
				const drinker = await mongo.getDrinkerProfile({ "discordId" : interaction.user.id });
				const formatted_ingr = {};
				drinker.ingredients.forEach(v => formatted_ingr[v.code] = v.amount);
				const available = tools.getAvailableRecipes(formatted_ingr);
				const choices = available.map(v => ({
					value: v[0],
					name: `${v[1].name} - ${tools.getXP(recipes[v[0]].ingredients)} XP`
				}));
				const filtered = choices.filter(choice => choice.value.toLowerCase().includes(focusedValue.toLowerCase()));
				await interaction.respond(filtered);
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
				const hasModRole = member.roles.cache.find(r => r.id === "1044662246544003176") || user.id === "236174876933619713";
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
					.setCustomId('setup-stream-modal')
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
		},
		// Cheat
		{
			data: new SlashCommandBuilder().setName('cheat').setDescription('Cheat du developpeur ;)')
				.addBooleanOption(option => option.setName('cheat-ingredient').setDescription('Give 10 exemplaires de chaque ingredient').setRequired(true)),
			execute: async (client, interaction) => {
				if(interaction.user.id !== "236174876933619713")
				{
					return await interaction.reply({ content: 'N\'essaie pas de tricher, c\'est reservé à certaines personnes seulement ;)', ephemeral: true });
				}
				const ingredient = interaction.options.get('cheat-ingredient').value;
				if(ingredient) {
					await mongo.setAll10Ingredients();
					await interaction.reply({ content: '10 ingredients de chaque type vous ont été donnés', ephemeral: true });
				}
			}
		},
	]
};

module.exports = data;