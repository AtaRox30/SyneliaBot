const Comfy = require('comfy.js');

const data = {
	listen: (twitchName, callback) => {
		Comfy.Init(twitchName, process.env.TWITCH_OAUTH);
		Comfy.onChat = (user, message, flags, self, extra) => callback(user, message, flags, self, extra);
	},
	close: () => {
		Comfy.Disconnect();
	}
}

module.exports = data;