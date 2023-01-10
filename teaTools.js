const Jimp = require('jimp');
const ingredients = require('./ingredients.json');
const recipes = require('./recipes.json');

function S4() {
	return (((1+Math.random())*0x10000)|0).toString(16).substring(1)
}

function guid() {
	return (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
}

function fill(color) {
    return function (x, y, offset) {
      this.bitmap.data.writeUInt32BE(color, offset, true);
    }
}

const data = {
	buildBasket: async (ingredient_key, count) => {
		return new Promise(async (res, rej) => {
			try {
				const key = count < 5 ? "basket_1" : count < 15 ? "basket_2" : "basket_3";
				const basket = await Jimp.read(ingredients[ingredient_key].url[key]);
				basket.resize(210, 150);
				const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
				const margin = count <= 1 ? 0.46 : 0.46 - 0.03 * Math.floor(Math.log10(count));
				basket.print(font, basket.getWidth() * margin, basket.getHeight() * 0.70, count);
				const url = `./assets/tmp/${guid()}.png`;
				await basket.writeAsync(url);
				res(url);
			} catch(e) {
				rej(e);
			}
		});
	},
	buildIngredientsStore: async (...paths) => {
		return new Promise(async (res, rej) => {
			try {
				paths.length > 9 ? paths.length = 9 : '';
				const store = await Jimp.read("./assets/etagere.png");
				const x = [.04, .38, .73];
				const y = [.02, .30, .57];
				const assembled = [];
				paths.forEach(v => assembled.push(Jimp.read(v)));
				Promise.all(assembled).then(() => Promise.all(assembled))
				.then(async (data) => {
					data.flatMap((img, index) => {
						store.composite(img, store.getWidth() * x[index % 3], store.getHeight() * y[Math.floor(index / 3)]);
					})
				})
				.then(async () => {
					const url = `./assets/tmp/${guid()}.png`;
					await store.writeAsync(url);
					res(url);
				})
				.catch(e => rej(e))
			} catch(e) {
				rej(e);
			}
		});
	},
	buildTea: async (ingredientObj) => {
		return new Promise(async (res, rej) => {
			try {
				const aIngredients = [];
				Object.entries(ingredientObj).forEach(v => {for(let i = 0; i < v[1]; i++) aIngredients.push(v[0])});
				const theiere = await Jimp.read("./assets/theiere.png");
				const pos = [
					{x: 0.4, y: 0.5, g: [1]},
					{x: 0.3, y: 0.45, g: [2, 4]},
					{x: 0.56, y: 0.67, g: [2, 3]},
					{x: 0.45, y: 0.45, g: [3]},
					{x: 0.3, y: 0.6, g: [3]},
					{x: 0.6, y: 0.45, g: [4]},
					{x: 0.3, y: 0.65, g: [4]},
					{x: 0.48, y: 0.73, g: [4]}
				];
				const posToApply = pos.filter(v => v.g.includes(aIngredients.length));
				const assembled = [];
				aIngredients.forEach(v => assembled.push(Jimp.read(ingredients[v].url.main)));
				Promise.all(assembled).then(() => Promise.all(assembled))
				.then(async (data) => {
					data.flatMap((img, index) => {
						const settedWidth = 130;
						const scale = settedWidth / img.getWidth();
						img.resize(settedWidth, img.getHeight() * scale);
						theiere.composite(img, theiere.getWidth() * posToApply[index].x, theiere.getHeight() * posToApply[index].y);
					})
				})
				.then(async () => {
					const url = `./assets/tmp/${guid()}.png`;
					await theiere.writeAsync(url);
					res(url);
				})
				.catch(e => rej(e))
			} catch(e) {
				rej(e);
			}
		});
	},
	buildRecipesStore: async (paths, recipesInfos) => {
		return new Promise(async (res, rej) => {
			try {
				paths.length > 5 ? paths.length = 5 : '';
				const store = await Jimp.read("./assets/etagere.png");
				const pos = [
					{x: .04, y: .02},
					{x: .73, y: .02},
					{x: .38, y: .30},
					{x: .04, y: .57},
					{x: .73, y: .57}
				];
				const assembled = [];
				paths.forEach(v => assembled.push(Jimp.read(v)));
				Promise.all(assembled).then(() => Promise.all(assembled))
				.then(async (data) => {
					data.flatMap((img, index) => {
						const settedWidth = 200;
						const scale = settedWidth / img.getWidth();
						img.resize(settedWidth, img.getHeight() * scale);
						store.composite(img, store.getWidth() * pos[index].x, store.getHeight() * pos[index].y);
					});

					const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
					const panels = [];
					[0, 0, 0, 0, 0].forEach(v => panels.push(Jimp.read("./assets/panneau.png")));
					await Promise.all(panels).then(() => Promise.all(panels)).then((panels) => {
						pos.flatMap(async (position, index) => {
							if(index > data.length - 1) return
							const titre = recipesInfos[index].name;
							const margin = (length) => 0.5 - 0.0175 * length;
							const xp = data.getXP(recipesInfos[index].ingredients);
	
							const panel = panels[index];
							panel.print(font, panel.getWidth() * margin(titre.length), panel.getHeight() * 0.4, titre);
							panel.print(font, panel.getWidth() * margin(`${xp} XP`.length), panel.getHeight() * 0.55, `${xp} XP`);
							const settedWidth = 115;
							const scale = settedWidth / panel.getWidth();
							panel.resize(settedWidth, panel.getHeight() * scale);
	
							store.composite(panel, store.getWidth() * (position.x + .05), store.getHeight() * (position.y + .27));
						});
					});
				})
				.then(async () => {
					const url = `./assets/tmp/${guid()}.png`;
					await store.writeAsync(url);
					res(url);
				})
				.catch(e => rej(e))
			} catch(e) {
				rej(e);
			}
		});
	},
	getXP: (ingredientsObject) => {
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
		 * e.g. Fraise → 5(1 - 0.4) * (1 - 1/7) = 3 * 0.85 = 1.7
		 * e.g. Bergamotte → 5(1 - 0.1) * (1 - 1/4) = 4.5 * 0.75 = 3.375
		 * e.g. Carthame → 5(1 - 0.05) * (1 - 1/3) = 4.75 * 0.66 = 3.135
		 */
		const dRate = {
			"COMMON": 0.4,
			"RARE": 0.3,
			"EPIC": 0.15,
			"LEGENDARY": 0.10,
			"MYTHICAL": 0.05,
		};
		const nbInCat = (cat) => Object.entries(ingredients).filter(v => v[1].rank === cat).length;
		let xp = 0;
		Object.entries(ingredientsObject).forEach(v => {
			const rank = ingredients[v[0]].rank;
			const drop = dRate[rank];
			xp += 5 * (1 - drop) * (1 - 1/nbInCat(rank))
		});
		return Math.round(xp);
	},
	getAvailableRecipes: (ingredientsObject) => {
		/**
		 * ingredientsObject → { ORANGE: 4, FRAMBOISE: 2 }
		 * entries → [["ORANGE", 4], ["FRAMBOISE", 2]]
		 * recipes → "ANASTASIA" : { "name": "Anastasia", "ingredients": { CITRON: 1, FRAMBOISE: 2 } }
		 * 
		 * entries → [["ANASTASIA", { "name": "Anastasia", "ingredients": { CITRON: 1, FRAMBOISE: 2 } }]]
		 * recipe_ingr → [["CITRON", 1], ["FRAMBOISE", 2]]
		 */
		return Object.entries(recipes).filter(r => {
			const recipe_ingr = Object.entries(r[1].ingredients);
			let allChecked = true;
			for(let [k, v] of recipe_ingr)
			{
				if(!ingredientsObject[k]) return false;
				ingredientsObject[k] < v ? allChecked = false : undefined;
			}
			return allChecked;
		});
	},
}

module.exports = data;