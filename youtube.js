const config = require("./config.json");
const request = require("request");

const getToken = (callback) => {
	const options = {
		url: config.URL["YOUTUBE"]["GET_TOKEN_YTB"],
		json: true,
		body: {
			client_id: process.env.YOUTUBE_CLIENT_ID,
			client_secret: process.env.YOUTUBE_CLIENT_SECRET,
			refresh_token: config["YOUTUBE"]["REFRESH"],
			grant_type: 'refresh_token'
		}
	}

	request.post(options, (err, res, body) => {
		if(err) return console.error(err);
		callback(body.access_token);
	})
}


const ytb = {
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
	}
}

module.exports = ytb;