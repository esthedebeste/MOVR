import { blueprint } from "coggers";
import { fetch } from "undici";
import discordcreds from "../../config/discordcreds.json";
import { database, url } from "../utils.js";

/**
 * @param {string} code - Code from the discord redirect
 * @param {string} redirect  - The discord redirect URI
 * @returns {Promise<{access_token: string}>} A discord token
 */
async function loginToDiscord(code, redirect) {
	const result = await fetch("https://discord.com/api/v8/oauth2/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"User-Agent": "MOVR",
		},
		body: `client_id=${discordcreds.id}&client_secret=${discordcreds.secret}&grant_type=authorization_code&code=${code}&redirect_uri=${redirect}&scope=identify`,
	});
	return result.json();
}

/**
 * Get the currently logged in user's id
 * @param {string} token - Discord Bearer token (Not the bot token!)
 * @returns {Promise<number>} Discord ID
 */
async function getDiscordUserId(token) {
	const result = await fetch("https://discord.com/api/users/@me", {
		headers: {
			Authorization: `Bearer ${token}`,
			"User-Agent": "MOVR",
		},
	});
	const data = await result.json();
	return data.id;
}

export const auth = blueprint({
	login: {
		async $get(req, res) {
			let code = req.query.code;
			if (code) {
				try {
					const session = await loginToDiscord(
						code,
						url + "auth/discord/login"
					);
					const id = await getDiscordUserId(session.access_token);
					try {
						const userid = await database.createAccountWith("discord_id", id);
						req.session.userid = userid;
						res.redirect("/id/" + userid);
					} catch (err) {
						console.error(err);
						res.error(500, "Database Error.");
					}
				} catch (err) {
					console.error(err);
					res.error(500, "Discord Error.");
				}
			} else res.error("Discord Callback Broken.");
		},
	},
	add: {
		async $get(req, res) {
			let code = req.query.code;
			if (!code) return res.error(401, "Log in first!");
			if (req.session.userid == null)
				return res.error(400, "Discord Callback Broken!");
			try {
				const { access_token } = await loginToDiscord(
					code,
					url + "auth/discord/add"
				);
				try {
					const id = await getDiscordUserId(access_token);
					try {
						await database.addToAccount("discord_id", req.session.userid, id);
						res.redirect("/id/" + req.session.userid);
					} catch (err) {
						console.error(err);
						res.error(500, "Database Error.");
					}
				} catch (err) {
					console.error(err);
					res.error(500, "Discord Error.");
				}
			} catch (err) {
				console.error(err);
				res.error(500);
			}
		},
	},
});

export const api = blueprint({
	getname: {
		async $get(req, res) {
			const id = parseInt(req.query.id);
			if (isNaN(id)) return res.error(400, "Error.");
			const user = await fetch(
				`https://discord.com/api/v8/users/${req.query.id}`,
				{
					headers: {
						Authorization: `Bot ${discordcreds.bot}`,
						"User-Agent": "MOVR",
					},
				}
			);
			const { username, discriminator } = await user.json();
			const code = username + "#" + discriminator;
			req.format({
				json: () =>
					res.json({
						name: code,
					}),
				default: () => res.end(username + "#" + discriminator),
			});
		},
	},
});

export const redirect = blueprint({
	login: {
		$get(req, res) {
			res.redirect(
				`https://discord.com/api/oauth2/authorize?client_id=${discordcreds.id}&redirect_uri=${url}auth/discord/login&response_type=code&scope=identify&prompt=consent`
			);
		},
	},
	add: {
		$get(req, res) {
			if (req.session.userid == null) return res.error(401, "Log In First!");
			res.redirect(
				`https://discord.com/api/oauth2/authorize?client_id=${discordcreds.id}&redirect_uri=${url}auth/discord/add&response_type=code&scope=identify&prompt=consent`
			);
		},
	},
});
