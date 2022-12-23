const config = require("./config.json");
const request = require("request");

const getToken = (callback) => {
	const options = {
		url: config.URL["TWITCH"]["GET_TOKEN"],
		json: true,
		body: {
			client_id: process.env.TWITCH_CLIENT_ID,
			client_secret: process.env.TWITCH_CLIENT_SECRET,
			grant_type: 'client_credentials'
		}
	}

	request.post(options, (err, res, body) => {
		if(err) return console.error(err);
		callback(body.access_token);
	})
}

const getVODPage = (at, pagination) => {
	const options = {
		url: config.URL["TWITCH"]["GET_VIDEOS"] + '?user_id=' + config["BROADCASTER"]["ID"] + (pagination ? ('&after=' + pagination) : '') + '&sort=time',
		json: true,
		headers: {
			'Client-Id': process.env.TWITCH_CLIENT_ID,
			'Authorization': 'Bearer ' + at
		}
	}

	return new Promise(function(resolve, reject) {
		request.get(options, (err, res, body) => {
			if (!err && res.statusCode === 200) {
				resolve(body);
			} else {
				reject(err);
			}
		})
	});
}

const getClipsPage = (at) => {
	const options = {
		url: config.URL["TWITCH"]["GET_CLIPS"] + '?broadcaster_id=' + config["BROADCASTER"]["ID"] + '&sort=time',
		json: true,
		headers: {
			'Client-Id': process.env.TWITCH_CLIENT_ID,
			'Authorization': 'Bearer ' + at
		}
	}

	return new Promise(function(resolve, reject) {
		request.get(options, (err, res, body) => {
			if (!err && res.statusCode === 200) {
				resolve(body);
			} else {
				reject(err);
			}
		})
	});
}

const getStreamers = (at) => {
	const options = {
		url: config.URL["TWITCH"]["GET_CHANNELS"] + '?query=' + config["BROADCASTER"]["LOGIN"],
		json: true,
		headers: {
			'Client-Id': process.env.TWITCH_CLIENT_ID,
			'Authorization': 'Bearer ' + at
		}
	}

	return new Promise(function(resolve, reject) {
		request.get(options, (err, res, body) => {
			if (!err && res.statusCode === 200) {
				resolve(body);
			} else {
				reject(err);
			}
		})
	});
}

const getGames = (at, id) => {
	const options = {
		url: config.URL["TWITCH"]["GET_GAMES"] + '?id=' + id,
		json: true,
		headers: {
			'Client-Id': process.env.TWITCH_CLIENT_ID,
			'Authorization': 'Bearer ' + at
		}
	}

	return new Promise(function(resolve, reject) {
		request.get(options, (err, res, body) => {
			if (!err && res.statusCode === 200) {
				resolve(body);
			} else {
				reject(err);
			}
		})
	});
}

const getUsersById = (at, id) => {
	const options = {
		url: config.URL["TWITCH"]["GET_USER_ID"] + '?id=' + id,
		json: true,
		headers: {
			'Client-Id': process.env.TWITCH_CLIENT_ID,
			'Authorization': 'Bearer ' + at
		}
	}

	return new Promise(function(resolve, reject) {
		request.get(options, (err, res, body) => {
			if (!err && res.statusCode === 200) {
				resolve(body);
			} else {
				reject(err);
			}
		})
	});
}

const getUsersByName = (at, id) => {
	const options = {
		url: config.URL["TWITCH"]["GET_USER_ID"] + '?login=' + id,
		json: true,
		headers: {
			'Client-Id': process.env.TWITCH_CLIENT_ID,
			'Authorization': 'Bearer ' + at
		}
	}

	return new Promise(function(resolve, reject) {
		request.get(options, (err, res, body) => {
			if (!err && res.statusCode === 200) {
				resolve(body);
			} else {
				reject(err);
			}
		})
	});
}

const getChatters = () => {
	const options = {
		url: "https://tmi.twitch.tv/group/user/" + config["BROADCASTER"]["LOGIN"] + "/chatters",
		json: true
	}

	return new Promise(function(resolve, reject) {
		request.get(options, (err, res, body) => {
			if (!err && res.statusCode === 200) {
				resolve(body);
			} else {
				reject(err);
			}
		})
	});
}

const twitch = {
	getVODS: async () => {
		return new Promise((resolve, reject) => {
			getToken(async (at) => {
				let pagination = undefined;
				const res = [];
				do {
					const r = await getVODPage(at, pagination);
					res.push(...r.data);
					pagination = r.pagination.cursor;
				}
				while(pagination)
				resolve(res);
			});
		});
	},

	getClips: async () => {
		return new Promise((resolve, reject) => {
			getToken(async (at) => {
				let pagination = undefined;
				const res = [];
				do {
					const r = await getClipsPage(at, pagination);
					res.push(...r.data);
					pagination = r.pagination.cursor;
				}
				while(pagination)
				resolve(res);
			});
		});
	},

	getChannel: async () => {
		return new Promise((resolve, reject) => {
			getToken(async (at) => {
				const aStreamers = await getStreamers(at);
				const stream = aStreamers.data.filter(s => s.broadcaster_login === config["BROADCASTER"]["LOGIN"])[0];
				resolve(stream);
			});
		});
	},

	getGame: async (id) => {
		return new Promise((resolve, reject) => {
			getToken(async (at) => {
				const games = await getGames(at, id);
				resolve(games.data[0]);
			});
		});
	},

	getUserById: async (id) => {
		return new Promise((resolve, reject) => {
			getToken(async (at) => {
				const users = await getUsersById(at, id);
				resolve(users.data[0]);
			});
		});
	},

	getUserByName: async (id) => {
		return new Promise((resolve, reject) => {
			getToken(async (at) => {
				const users = await getUsersByName(at, id);
				resolve(users.data[0]);
			});
		});
	},

	getChatters: async () => {
		const users = await getChatters();
		return users.chatters.viewers;
	},
}

module.exports = twitch;