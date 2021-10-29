import { YoutubeAuth } from "@tbhmens/google-auth";
import { blueprint } from "coggers";
import { fetch } from "undici";
import googlecreds from "../../config/googlecreds.json";
import { database, url } from "../utils.js";

const youtubeLogin = new YoutubeAuth(
	googlecreds.web.client_id,
	googlecreds.web.client_secret,
	url + "auth/youtube/login"
);
const youtubeAdd = new YoutubeAuth(
	googlecreds.web.client_id,
	googlecreds.web.client_secret,
	url + "auth/youtube/add"
);

export const auth = blueprint({
	login: {
		async $get(req, res) {
			try {
				const { id } = await youtubeLogin.verify(req.query, req.session, [
					"id",
				]);
				try {
					const userid = await database.createAccountWith("youtube_id", id);
					req.session.userid = userid;
					res.redirect("/youtube/" + id);
				} catch (err) {
					console.error(err);
					res.error(500, "Database Error");
				}
			} catch (err) {
				console.error(err);
				res.error(500, "YouTube Error");
			}
		},
	},
	add: {
		async $get(req, res) {
			if (req.session.userid == null) return res.error(401, "Log In First!");

			try {
				const { id } = await youtubeAdd.verify(req.query, req.session, ["id"]);
				try {
					await database.addToAccount("youtube_id", req.session.userid, id);
					res.redirect("/youtube/" + id);
				} catch (err) {
					console.error(err);
					res.error(500, "Database Error");
				}
			} catch (err) {
				console.error(err);
				res.error(500, "YouTube Error");
			}
		},
	},
});
export const redirect = blueprint({
	login: {
		async $get(req, res) {
			try {
				const url = await youtubeLogin.getAuthUrl(
					"select_account",
					req.session
				);
				res.redirect(url);
			} catch (err) {
				console.error(err);
				res.error(500, "YouTube Error");
			}
		},
	},
	add: {
		async $get(req, res) {
			if (req.session.userid == null) return res.error(401, "Log In First!");
			try {
				const url = await youtubeAdd.getAuthUrl("select_account", req.session);
				res.redirect(url);
			} catch (err) {
				console.error(err);
				res.error(500, "YouTube Error");
			}
		},
	},
});
export const api = blueprint({
	getname: {
		async $get(req, res) {
			if (req.query.id == null) return res.error(400);
			try {
				const result = await fetch(
					`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${req.query.id}&key=${googlecreds.api_key}`,
					{ headers: { "User-Agent": "MOVR" } }
				);
				const data = await result.json();
				const channel = data.items[0];
				res.json({
					name: channel.snippet.title,
					html_url: "https://youtube.com/channel/" + channel.id,
				});
			} catch (err) {
				console.error(err);
				res.error(500, "YouTube Error");
			}
		},
	},
});
export const embed = async name => {
	try {
		const result = await fetch(
			`https://www.googleapis.com/youtube/v3/channels?part=snippet&part=id&id=${name}&key=${googlecreds.api_key}`,
			{
				headers: {
					Accept: "application/json",
					"User-Agent": "MOVR",
				},
			}
		);
		const data = await result.json();
		if (data.pageInfo.totalResults < 1) return "This account doesn't exist.";
		try {
			const user = await database.getUser("YOUTUBE_ID", name);
			if (user == null) return "This person doesn't have a movr account!";
			let account = data.items[0];
			account.name = account.snippet.title;
			account.html_url = "https://youtube.com/channel/" + account.id;
			account.picture = account.snippet.thumbnails.high.url;
			return {
				dbdata: user,
				userdata: {
					YOUTUBE_ID: account,
				},
			};
		} catch (err) {
			console.error(err);
			return "Database Error.";
		}
	} catch (err) {
		console.error(err);
		return "YouTube Error.";
	}
};
