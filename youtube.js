const config = require("./config.json");
const request = require("request");

const getVODPage = async (pagination) => {
	const options = {
		url: config["URL"]["YOUTUBE"]["GET_SEARCH"] + 
			"?key=" + process.env.YOUTUBE_API_KEY + 
			"&type=video&channelId=" + config["VIDEO_CREATOR"]["ID"] + 
			(pagination ? "&nextPageToken=" + pagination : ""),
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

const getVideoInfo = async (id) => {
	const options = {
		url: config["URL"]["YOUTUBE"]["GET_VIDEO"] + 
			"?key=" + process.env.YOUTUBE_API_KEY + 
			"&part=snippet&id=" + id,
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


const ytb = {
	getVODS: async () => {
		return new Promise(async (resolve, reject) => {
			let pagination = undefined;
			const resId = [];
			const res = [];
			do {
				const r = await getVODPage(pagination);
				resId.push(...r.items.map(v => v.id.videoId));
				pagination = r.nextPageToken;
			}
			while(pagination)
			for(let videoId of resId) {
				const info = await getVideoInfo(videoId);
				res.push(info.items[0])
			}
			resolve(res);
		});
	}
}

module.exports = ytb;