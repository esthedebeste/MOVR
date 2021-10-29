import { blueprint } from "coggers";
import { fetch } from "undici";
import ghcreds from "../../config/ghclientcreds.json";
import { database, url } from "../utils.js";
export const auth = blueprint({
	login: {
		async $get(req, res) {
			let code = req.query.code;
			if (!code) return res.redirect("/");
			try {
				const { access_token } = await loginToGithub(code);
				try {
					const id = await getGithubUserId(access_token);
					try {
						const userid = await database.createAccountWith("github_id", id);
						req.session.userid = userid;
						res.redirect("/id/" + userid);
					} catch (err) {
						console.error(err);
						res.error(500, "Database Error.");
					}
				} catch (err) {
					console.error(err);
					res.error(500, "GitHub Error.");
				}
			} catch (err) {
				console.error(err);
				res.error(500, "GitHub Error.");
			}
		},
	},
	add: {
		async $get(req, res) {
			let code = req.query.code;
			if (!code) return res.error(400, "You need to be logged in.");
			if (req.session.userid == null) return res.redirect("/");
			try {
				const { access_token } = await loginToGithub(code);
				try {
					const id = await getGithubUserId(access_token);
					try {
						await database.addToAccount("github_id", req.session.userid, id);
						res.redirect("/id/" + req.session.userid);
					} catch (err) {
						console.error(err);
						res.error(500, "Database Error.");
					}
				} catch (err) {
					console.error(err);
					res.error(500, "GitHub Error.");
				}
			} catch (err) {
				console.error(err);
				res.error(500, "GitHub Error.");
			}
		},
	},
});
/**
 *
 * @param {string} code - Code for authentication
 * @returns {Promise<string>} GitHub Access token
 */
async function loginToGithub(code) {
	const result = await fetch("https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"User-Agent": "MOVR",
		},
		body: JSON.stringify({
			client_id: ghcreds.id,
			client_secret: ghcreds.secret,
			code,
		}),
	});
	return result.json();
}

/**
 * https://docs.github.com/en/rest/reference/users#get-the-authenticated-user
 * @param {string} token - GitHub access token
 * @returns {Promise<object>} GitHub user profile
 */
async function getGithubUserId(token) {
	const result = await fetch("https://api.github.com/user", {
		headers: {
			Authorization: `Bearer ${token}`,
			"User-Agent": "MOVR",
		},
	});
	const data = await result.json();
	return data.id;
}

export async function embed(name) {
	try {
		const result = await fetch("https://api.github.com/users/" + name, {
			headers: {
				Username: ghcreds.tokenauth.username,
				Password: ghcreds.tokenauth.password,
				"User-Agent": "MOVR",
			},
		});
		const data = await result.json();
		data.picture = data.avatar_url;
		try {
			const user = await database.getUser("github_id", data.id);
			return {
				dbdata: user,
				userdata: {
					GITHUB_ID: data,
				},
			};
		} catch (err) {
			console.error(err);
			return "Database Error";
		}
	} catch (err) {
		console.error(err);
		throw "GitHub Error.";
	}
}

export async function embedId(name) {
	if (isNaN(name)) return "Invalid ID.";
	try {
		const user = await database.getUser("GITHUB_ID", name);
		if (user == null) return "This person doesn't have a movr account!";
		else
			return {
				dbdata: user,
				userdata: {
					ID: {
						name: "null",
						html_url: url,
						picture: url + "/favicon.svg",
					},
				},
			};
	} catch (err) {
		console.error(err);
		return "Database Error";
	}
}

export const redirect = blueprint({
	login: {
		$get(req, res) {
			res.redirect(
				`https://github.com/login/oauth/authorize?scope=user:email&client_id=${ghcreds.id}&redirect_uri=${url}auth/github/login`
			);
		},
	},
	add: {
		$get(req, res) {
			if (req.session.userid == null) return res.error(401, "Log In First!");
			res.redirect(
				`https://github.com/login/oauth/authorize?scope=user:email&client_id=${ghcreds.id}&redirect_uri=${url}auth/github/add`
			);
		},
	},
});
