import SteamAuth from "@tbhmens/steam-auth";
import { blueprint } from "coggers";
import { fetch } from "undici";
import steamcreds from "../../config/steamcreds.json";
import { database, url } from "../utils.js";

const authlogin = new SteamAuth(url + "auth/steam/login", url);
const authadd = new SteamAuth(url + "auth/steam/add", url);

export const auth = blueprint({
	login: {
		async $get(req, res) {
			try {
				const steamId = await authlogin.verify(req);
				try {
					const userid = await database.createAccountWith("steam_id", steamId);
					req.session.userid = userid;
					res.redirect("/id/" + userid);
				} catch (err) {
					console.error(err);
					res.error(500, "Database Error.");
				}
			} catch (err) {
				console.error(err);
				res.error(500, "Steam Authentication Error.");
			}
		},
	},
	add: {
		async $get(req, res) {
			if (req.session.userid == null) return res.error(400, "Log in first!");

			try {
				const steamId = await authadd.verify(req);
				try {
					await database.addToAccount("steam_id", req.session.userid, steamId);
					res.redirect("/id/" + req.session.userid);
				} catch (err) {
					console.error(err);
					res.error(500, "Database Error.");
				}
			} catch (err) {
				console.error(err);
				res.error(500, "Steam Authentication Error.");
			}
		},
	},
});
export const redirect = blueprint({
	login: {
		async $get(req, res) {
			try {
				res.redirect(await authlogin.getAuthUrl());
			} catch (error) {
				res.error(500, "Steam Error.");
			}
		},
	},
	add: {
		async $get(req, res) {
			try {
				res.redirect(await authadd.getAuthUrl());
			} catch (error) {
				res.error(500, "Steam Error.");
			}
		},
	},
});

export const api = blueprint({
	getname: {
		async $get(req, res) {
			if (isNaN(req.query.id)) return res.error(400, "Error!");
			try {
				const result = await fetch(
					`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamcreds.key}&steamids=${req.query.id}`,
					{ headers: { "User-Agent": "MOVR" } }
				);
				const data = await result.json();
				const player = data.response.players[0];
				res.json({
					name: player.personaname,
					html_url: player.profileurl,
				});
			} catch (err) {
				console.error(err);
				res.error(500, "Steam Error.");
			}
		},
	},
});

export const embed = async name => {
	try {
		const result = await fetch(
			`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${steamcreds.key}&vanityurl=${name}&url_type=1`,
			{ headers: { "User-Agent": "MOVR" } }
		);
		const data = await result.json();
		const success = data.response.success;
		const steamid = data.response.steamid;
		if (success === 1) {
			try {
				const result = await fetch(
					`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamcreds.key}&steamids=${steamid}`,
					{ headers: { "User-Agent": "MOVR" } }
				);
				const data = await result.json();
				const player = data.response.players[0];
				try {
					const user = await database.getUser("STEAM_ID", player.steamid);
					if (user == null) return "This person doesn't have a movr account!";
					else {
						player.name = player.personaname;
						player.html_url = player.profileurl;
						player.picture = player.avatarfull;
						return {
							dbdata: user,
							userdata: {
								STEAM_ID: player,
							},
						};
					}
				} catch (err) {
					console.error(err);
					return "Database Error.";
				}
			} catch (err) {
				console.error(err);
				return "Steam Error.";
			}
		} else if (success === 42) return "This account doesn't exist.";
		else return "Steam Error.";
	} catch (err) {
		console.error(err);
		return "Steam Error.";
	}
};
