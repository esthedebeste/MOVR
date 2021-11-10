import { blueprint } from "coggers";
import oauth from "oauth";
import { fetch } from "undici";
import twittercreds from "../../config/twittercreds.json";
import { database, url } from "../utils.js";

const loginOauth = new oauth.OAuth(
	"https://twitter.com/oauth/request_token",
	"https://twitter.com/oauth/access_token",
	twittercreds.apikey,
	twittercreds.apisecret,
	"1.0A",
	url + "auth/twitter/login",
	"HMAC-SHA1"
);
const addOauth = new oauth.OAuth(
	"https://twitter.com/oauth/request_token",
	"https://twitter.com/oauth/access_token",
	twittercreds.apikey,
	twittercreds.apisecret,
	"1.0A",
	url + "auth/twitter/add",
	"HMAC-SHA1"
);

export const redirect = blueprint({
	login: {
		$get: twitterRedirect("authenticate", loginOauth),
	},
	add: {
		$get: twitterRedirect("authorize", addOauth),
	},
});

/**
 *
 * @param {"authenticate" | "authorize"} method - Twitter authentication method
 * @param {oauth.OAuth} oauth - oauth.Oauth instance to use
 * @returns {(req: Request, res: Response)=>Promise<void>}
 */
function twitterRedirect(method, oauth) {
	return async (req, res) => {
		try {
			const { oauthRequestToken, oauthRequestTokenSecret } =
				await getOAuthRequestToken(oauth);
			req.session.twitterOauthRequestToken = oauthRequestToken;
			req.session.twitterOauthRequestTokenSecret = oauthRequestTokenSecret;
			res.saveSession();

			res.redirect(
				`https://api.twitter.com/oauth/${method}?oauth_token=${oauthRequestToken}`
			);
		} catch (err) {
			console.error(err);
			res.error(500, "Twitter Error.");
		}
	};
}

/**
 * @param {oauth.OAuth} oauth - OAuth instance
 * @returns {Promise<{oauthRequestToken: string, oauthRequestTokenSecret: string, results: object}>} Request Token
 */
function getOAuthRequestToken(oauth) {
	return new Promise((resolve, reject) => {
		oauth.getOAuthRequestToken(function (
			error,
			oauthRequestToken,
			oauthRequestTokenSecret,
			results
		) {
			if (error) reject(error);
			else
				resolve({
					oauthRequestToken,
					oauthRequestTokenSecret,
					results,
				});
		});
	});
}

/**
 *
 * @param {string} oauthRequestToken
 * @param {string} oauthRequestTokenSecret
 * @param {string} oauthVerifier
 * @param {oauth.Oauth} oauth
 * @returns {Promise<{oauthAccessToken: string, oauthAccessTokenSecret: string, results: {id: number, id_str: string,name: string, screen_name: string, location: string|null, url: string|null, description: string|null, protected: boolean, verified: boolean, followers_count: number, friends_count: number, listed_count: number, favourites_count: number, statuses_count: number, created_at: string, profile_banner_url: string, profile_image_url_https: string, default_profile: boolean, default_profile_image: boolean, withheld_in_countries: string[], withheld_scope: "user"|undefined}}>}
 */
function getOAuthAccessTokenWith(
	oauthRequestToken,
	oauthRequestTokenSecret,
	oauthVerifier,
	oauth
) {
	return new Promise((resolve, reject) => {
		oauth.getOAuthAccessToken(
			oauthRequestToken,
			oauthRequestTokenSecret,
			oauthVerifier,
			function (error, oauthAccessToken, oauthAccessTokenSecret, results) {
				if (error) reject(error);
				else
					resolve({
						oauthAccessToken,
						oauthAccessTokenSecret,
						results,
					});
			}
		);
	});
}

/**
 *
 * @param {Request} req
 * @param {Response} res
 * @param {oauth.OAuth} oauth
 * @returns {Promise<{id: number, id_str: string,name: string, screen_name: string, location: string|null, url: string|null, description: string|null, protected: boolean, verified: boolean, followers_count: number, friends_count: number, listed_count: number, favourites_count: number, statuses_count: number, created_at: string, profile_banner_url: string, profile_image_url_https: string, default_profile: boolean, default_profile_image: boolean, withheld_in_countries: string[], withheld_scope: "user"|undefined}>}
 */
async function twitterCallback(req, res, oauth) {
	const { twitterOauthRequestToken, twitterOauthRequestTokenSecret } =
		req.session;
	const { oauth_verifier } = req.query;
	try {
		const { results } = await getOAuthAccessTokenWith(
			twitterOauthRequestToken,
			twitterOauthRequestTokenSecret,
			oauth_verifier,
			oauth
		);
		return results;
	} catch (err) {
		console.error(err);
		res.error(res);
		throw err;
	}
}

export const auth = blueprint({
	login: {
		async $get(req, res) {
			const user = await twitterCallback(req, res, loginOauth);
			delete req.session.twitterOauthRequestToken;
			delete req.session.twitterOauthRequestTokenSecret;
			const userid = await database.createAccountWith(
				"twitter_id",
				user.user_id
			);
			req.session.userid = userid;
			res.saveSession();
			res.redirect("/twitter/" + user.screen_name);
		},
	},
	add: {
		async $get(req, res) {
			if (req.session.userid == null) return res.error(400, "Log in first!");
			const user = await twitterCallback(req, res, addOauth);
			delete req.session.twitterOauthRequestToken;
			delete req.session.twitterOauthRequestTokenSecret;
			res.saveSession();
			await database.addToAccount(
				"twitter_id",
				req.session.userid,
				user.user_id
			);
			res.redirect("/twitter/" + user.screen_name);
		},
	},
});

export const api = blueprint({
	getname: {
		async $get(req, res) {
			if (!isNaN(req.query.id)) {
				try {
					const result = await fetch(
						`https://api.twitter.com/1.1/users/show.json?user_id=${req.query.id}&include_entities=false`,
						{
							headers: {
								Authorization: `Bearer ${twittercreds.bearertoken}`,
								"User-Agent": "MOVR",
							},
						}
					);
					const data = await result.json();
					data.html_url = "https://twitter.com/" + data.screen_name;
					res.json(data);
				} catch (err) {
					console.error(err);
					res.error(500, "Twitter Error.");
				}
			} else res.error(400, "Invalid Params.");
		},
	},
});
export const embed = async name => {
	try {
		const result = await fetch(
			`https://api.twitter.com/1.1/users/show.json?screen_name=${name}&include_entities=false`,
			{
				headers: {
					authorization: `Bearer ${twittercreds.bearertoken}`,
				},
			}
		);
		const data = await result.json();
		data.html_url = "https://twitter.com/" + data.screen_name;
		data.picture = data.profile_image_url_https.replace("_normal", "");
		data.entities = {};
		try {
			const user = await database.getUser("TWITTER_ID", data.id_str);
			return {
				dbdata: user,
				userdata: {
					TWITTER_ID: data,
				},
			};
		} catch (err) {
			console.error(err);
			return "Database Error";
		}
	} catch (err) {
		console.error(err);
		return "Twitter Error.";
	}
};
