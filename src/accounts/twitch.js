import TwitchAuth from "@tbhmens/twitch-auth";
import { blueprint } from "coggers";
import { fetch } from "undici";
import twitchcreds from "../../config/twitchcreds.json";
import { database, url } from "../utils.js";
const twitchLogin = new TwitchAuth(
	twitchcreds.id,
	twitchcreds.secret,
	url + "auth/twitch/login"
);
const twitchAdd = new TwitchAuth(
	twitchcreds.id,
	twitchcreds.secret,
	url + "auth/twitch/add"
);

let bearerKeyCache = null;
/**
 * Gets an application bearer key using the cache
 * @returns {Promise<{
 * 	access_token: string,
 *  timestamp: number // Code
 * }>}
 */
async function getBearerKey() {
	if (bearerKeyCache == null || bearerKeyCache.timestamp < Date.now() + 5000) {
		const result = await fetch(
			`https://id.twitch.tv/oauth2/token?client_id=${twitchcreds.id}&client_secret=${twitchcreds.secret}&grant_type=client_credentials`,
			{
				method: "POST",
				headers: { "User-Agent": "MOVR" },
			}
		);
		const { access_token, expires_in } = await result.json();

		return (bearerKeyCache = {
			access_token: access_token,
			timestamp: expires_in * 1000 + Date.now(),
		});
	} else return bearerKeyCache;
}

export const auth = blueprint({
	login: {
		async $get(req, res) {
			try {
				const { sub } = await twitchLogin.verify(req.query, req.session);
				try {
					const userid = await database.createAccountWith("twitch_id", sub);
					req.session.userid = userid;
					res.saveSession();
					res.redirect("/id/" + userid);
				} catch (err) {
					console.error(err);
					res.error(500, "Database Error.");
				}
			} catch (err) {
				console.error(err);
				res.error(500, "Authentication Error.");
			}
		},
	},
	add: {
		async $get(req, res) {
			if (req.session.userid == null) return res.error(401, "Log In First!");
			try {
				const { sub } = await twitchLogin.verify(req.query, req.session);
				try {
					await database.addToAccount("twitch_id", req.session.userid, sub);
					res.redirect("/id/" + req.session.userid);
				} catch (err) {
					console.error(err);
					res.error(500, "Database Errror.");
				}
			} catch (err) {
				console.error(err);
				res.error(500, "Authentication Error.");
			}
		},
	},
});

export const redirect = blueprint({
	login: {
		async $get(req, res) {
			try {
				const url = await twitchLogin.getAuthUrl(true, {}, req.session);
				res.saveSession();
				res.redirect(url);
			} catch (err) {
				console.error(err);
				res.error(500, "Twitch Error.");
			}
		},
	},
	add: {
		async $get(req, res) {
			if (req.session.userid == null) return res.error(401, "Log In First!");
			try {
				const url = await twitchAdd.getAuthUrl(true, {}, req.session);
				res.saveSession();
				res.redirect(url);
			} catch (err) {
				console.error(err);
				res.error(500, "Twitch Error.");
			}
		},
	},
});

export const api = blueprint({
	getname: {
		async $get(req, res) {
			if (req.query.id == null) return res.error(400);
			try {
				const { access_token } = await getBearerKey();
				const result = await fetch(
					`https://api.twitch.tv/helix/users?id=${req.query.id}`,
					{
						headers: {
							Authorization: `Bearer ${access_token}`,
							"Client-Id": twitchcreds.id,
							"User-Agent": "MOVR",
						},
					}
				);
				const name = (await result.json()).data[0].display_name;
				res.json({
					name,
					html_url: `https://twitch.tv/${name}`,
				});
			} catch (err) {
				console.error(err);
				res.error(500, "Twitch Error.");
			}
		},
	},
});

export const embed = async name => {
	const creds = await getBearerKey();
	try {
		const result = await fetch(
			`https://api.twitch.tv/helix/users?login=${name}`,
			{
				headers: {
					Authorization: `Bearer ${creds.access_token}`,
					"Client-Id": twitchcreds.id,
					"User-Agent": "MOVR",
				},
			}
		);
		const data = (await result.json()).data;

		data[0].name = data[0].display_name;
		data[0].html_url = "https://twitch.tv/" + data[0].login;
		data[0].picture = data[0].profile_image_url;
		try {
			const user = await database.getUser("TWITCH_ID", data[0].id);
			if (user == null) return "This person doesn't have a movr account!";
			else
				return {
					dbdata: user,
					userdata: {
						TWITCH_ID: data[0],
					},
				};
		} catch (err) {
			console.error(err);
			return "Database Error.";
		}
	} catch (err) {
		console.error(err);
		return "Twitch Error";
	}
};
