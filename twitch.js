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
	getClips: async () => {
		return new Promise((resolve, reject) => {
			try {
				getToken(async (at) => {
					let pagination = undefined;
					const res = [];
					try {
						let r = await getClipsPage(at, pagination);
						res.push(...r.data);
					} catch(e) {
						reject(e);
					}
					resolve(res);
				});
			} catch(e) {
				reject(e)
			}
		});
	},

	getChannel: async () => {
		return new Promise((resolve, reject) => {
			try {
				getToken(async (at) => {
					try {
						const aStreamers = await getStreamers(at);
						const stream = aStreamers.data.filter(s => s.broadcaster_login === config["BROADCASTER"]["LOGIN"])[0];
						resolve(stream);
					} catch(e) {
						reject(e)
					}
				});
			} catch(e) {
				reject(e)
			}
		});
	},

	getGame: async (id) => {
		return new Promise((resolve, reject) => {
			try {
				getToken(async (at) => {
					try {
						const games = await getGames(at, id);
						resolve(games.data[0]);
					} catch(e) {
						reject(e)
					}
				});
			} catch(e) {
				reject(e)
			}
		});
	},

	getUserById: async (id) => {
		return new Promise((resolve, reject) => {
			try {
				getToken(async (at) => {
					try {
						const users = await getUsersById(at, id);
						resolve(users.data[0]);
					} catch(e) {
						reject(e)
					}
				});
			} catch(e) {
				reject(e)
			}
		});
	},

	getUserByName: async (id) => {
		return new Promise((resolve, reject) => {
			try {
				getToken(async (at) => {
					try {
						const users = await getUsersByName(at, id);
						resolve(users.data[0]);
					} catch(e) {
						reject(e)
					}
				});
			} catch(e) {
				reject(e)
			}
		});
	},

	getChatters: async () => {
		const users = await getChatters();
		const toRet = [
			...users.chatters.viewers,
			...users.chatters.global_mods,
			...users.chatters.admins,
			...users.chatters.staff,
			...users.chatters.moderators,
			...users.chatters.vips,
			...users.chatters.broadcaster
		];
		return toRet;
	},
}

module.exports = twitch;