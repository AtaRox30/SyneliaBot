const Jimp = require('jimp');
const ingredients = require('./ingredients.json');

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
	buildStore: async (...paths) => {
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
}

module.exports = data;