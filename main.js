import json from "./jsonimport.js";
import ax from "axios";
import oauth from "oauth";
import session from "express-session";
import crypto from "crypto";
import {
	App
} from "@tinyhttp/app";
import sirv from "sirv";
import ejs from "ejs";
import SteamAuth from "@tbhmens/steam-auth";
import Database from "./db2.js";
const axios = ax.create({
	headers: {
		"User-Agent": "MOVR"
	}
});
const app = new App();
const port = process.env.PORT || 80;
const ghcreds = json("config/ghclientcreds.json");
const discordcreds = json("config/discordcreds.json");
const twitchcreds = json("config/twitchcreds.json");
const twittercreds = json("config/twittercreds.json");
const steamcreds = json("config/steamcreds.json");
const movrconfig = json("config/movrconfig.json");

let testingenv = process.env.LOCALTESTINGENVIRONMENT === "T";
// Format to a valid URL which ends with a /
let url = new URL(movrconfig.url).toString();
if (testingenv)
	url = "http://localhost/";

const db2config = json("config/db2config.json");
let database = new Database(db2config.tablename, testingenv);

app.engine("ejs", ejs.renderFile);
app.set("ext", "ejs");
app.use(sirv("public"));
app.use(session({
	secret: crypto.randomBytes(64).toString("utf16le"),
	resave: false,
	saveUninitialized: false,
	sameSite: "lax",
	name: "movr-sid"
}));

function error(res, code = 500, errtext = "Internal Error.") {
	res.status(code).render("error.ejs", {
		error: errtext
	});
}


app.get('/', (req, res) => {
	res.render("index.ejs", {
		ghid: ghcreds.id,
		discordid: discordcreds.id,
		twitchid: twitchcreds.id,
		url
	});
});

//#region API: Get accounts
app.get("/api/getaccount/gh/:id", (req, res) => {
	let id = req.params.id;
	if (!isNaN(id))
		database.getAccount("github_id", id, "ID").then(result => res.send(result)).catch(e => console.error(e));
});
app.get("/api/getaccount/:id", (req, res) => {
	let id = req.params.id;
	if (!isNaN(id))
		database.getUser("ID", id).then(user => res.send(user)).catch(e => console.error(e));
});

app.post("/deleteaccount", (req, res) => {
	if (!isNaN(req.session.userid))
		db.query(`delete from movr_users where id=${req.session.userid} limit 1`).catch(e => console.error(e));
});
// #endregion
//#region github
app.get("/ghcallback", async (req, res) => {
	let code = req.query.code;
	if (code)
		loginToGithub(code, githubredirect).then(session => {
			req.session.ghtoken = session.access_token;
			getGithubUserId(session.access_token).then(id => {
				database.createAccountWith("github_id", id).then(userid => {
					req.session.userid = userid;
					console.log(userid + " logged in!");
					res.redirect("/id/" + userid);
				}).catch(err => {
					console.error(err.toString());
					error(res, 500, "Database Error.");
				});
			}).catch(err => {
				console.error(err.toString());
				error(res, 500, "GitHub Error.");
			});
		});
	else
		res.redirect("/");
});
app.get("/ghcallback/add", async (req, res) => {
	let code = req.query.code;
	if (code)
		if (typeof (req.session.userid) !== "undefined")
			loginToGithub(code, githubredirect + "/add").then(session => {
				req.session.githubtoken = session.access_token;
				getGithubUserId(session.access_token).then(id => {
					database.addToAccount("github_id", req.session.userid, id).then(() => {
						res.redirect("/id/" + req.session.userid);
					}).catch(err => {
						console.error(err.toString());
						error(res, 500, "Database Error.");
					});
				}).catch(err => {
					console.error(err.toString());
					error(res, 500, "GitHub Error.");
				});
			}).catch(a => {
				res.send(JSON.stringify(a, null, ". . . ").replace(/\n/g, "<br>"));
			});
		else
			error(res, 400, "You need to be logged in.");
	else
		res.redirect("/");
});

function loginToGithub(session, redirect) {
	return new Promise((resolve, reject) => {
		axios.post("https://github.com/login/oauth/access_token", {
			client_id: ghcreds.id,
			client_secret: ghcreds.secret,
			code: session,
			accept: "json"
		}).then(result => {
			let a = result.data.split("&");
			let b = {};
			for (let i of a) {
				let vals = i.split("=");
				b[vals[0]] = vals[1];
			}
			resolve(b);
		}).catch(a => {
			reject(a);
		});
	});
}

function getGithubUserId(token) {
	return new Promise((resolve, reject) => {
		axios.get("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${token}`
			}
		}).then(result => {
			resolve(result.data.id);
		}).catch(reject);
	});
}

//#endregion
//#region discord
app.get("/discordcallback", async (req, res) => {
	let code = req.query.code;
	if (code)
		loginToDiscord(code, url + "discordcallback").then(session => {
			req.session.discordtoken = session.access_token;
			getDiscordUserId(session.access_token).then(id => {
				database.createAccountWith("discord_id", id).then(userid => {
					req.session.userid = userid;
					console.log(userid + " logged in!");
					res.redirect("/id/" + userid);
				}).catch(err => {
					console.error(err.toString());
					error(res, 500, "Database Error.");
				});
			}).catch(err => {
				console.error(err.toString());
				error(res, 500, "Discord Error.");
			});
		}).catch(a => {
			console.error(a.toString());
			error(res, 500);
		});
	else
		error(res, "Discord Callback Broken.");
});

function loginToDiscord(session, redirect) {
	return new Promise((resolve, reject) => {
		let data = `client_id=${discordcreds.id}&client_secret=${discordcreds.secret}&grant_type=authorization_code&code=${session}&redirect_uri=${redirect}&scope=identify`;
		axios.post("https://discord.com/api/v8/oauth2/token", data, {
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			}
		}).then(result => {
			resolve(result.data);
		}).catch(a => {
			reject(a);
		});
	});
}

function getDiscordUserId(token) {
	return new Promise((resolve, reject) => {
		axios.get("https://discord.com/api/users/@me", {
			headers: {
				Authorization: `Bearer ${token}`
			}
		}).then(result => {
			resolve(result.data.id);
		}).catch(reject);
	});
}

app.get("/discordcallbackadd", (req, res) => {
	let code = req.query.code;
	if (code)
		if (typeof (req.session.userid) !== "undefined")
			loginToDiscord(code, url + "discordcallbackadd").then(session => {
				req.session.discordtoken = session.access_token;
				getDiscordUserId(session.access_token).then(id => {
					database.addToAccount("discord_id", req.session.userid, id).then(userid => {
						res.redirect("/id/" + req.session.userid);
					}).catch(err => {
						console.error(err.toString());
						error(res, 500, "Database Error.");
					});
				}).catch(err => {
					console.error(err.toString());
					error(res, 500, "Discord Error.");
				});
			}).catch(a => {
				console.error(a);
				error(res, 500);
			});
		else
			error(res, 401, "Log in first!");
	else
		error(res, 400, "Discord Callback Broken!");
});

app.get("/getdiscordname/:discordid", (req, res) => {
	if (!isNaN(req.params.discordid)) {
		axios.get(`https://discord.com/api/v8/users/${req.params.discordid}`, {
			headers: {
				Authorization: `Bot ${discordcreds.bot}`
			}
		}).then(result => {
			res.send(result.data.username + "#" + result.data.discriminator);
		}).catch(() => {
			res.send("ERROR!");
		});
	} else
		error(res, 400, "Error.");
});


//#endregion
//#region twitch
app.get("/twitchcallback", async (req, res) => {
	let code = req.query.code;
	if (code)
		loginToTwitch(code, url + "twitchcallback").then(session => {
			req.session.twitchtoken = session.access_token;
			getTwitchUserId(session.access_token).then(id => {
				database.createAccountWith("twitch_id", id).then(userid => {
					req.session.userid = userid;
					console.log(userid + " logged in!");
					res.redirect("/id/" + userid);
				}).catch(err => {
					console.error(err.toString());
					error(res, 500, "Database Errror.");
				});
			}).catch(err => {
				console.error(err.toString());
				error(res, 500, "Twitch Error.");
			});
		});
	else
		error(res, 400, "Twitch Callback Broken.");
});
app.get("/twitchcallback/add", async (req, res) => {
	let code = req.query.code;
	if (code)
		if (typeof (req.session.userid) !== "undefined")
			loginToTwitch(code, url + "twitchcallback/add").then(session => {
				req.session.twitchtoken = session.access_token;
				getTwitchUserId(session.access_token).then(id => {
					database.addToAccount("twitch_id", req.session.userid, id).then(() => {
						res.redirect("/id/" + req.session.userid);
					}).catch(err => {
						console.error(err.toString());
						error(res, 500, "Database Errror.");
					});
				}).catch(err => {
					console.error(err.toString());
					error(res, 500, "Twitch Error.");
				});
			}).catch(a => {
				console.error(a);
				error(res, 500, "Twitch Error.");
			});
		else
			error(res, 401, "Log In First!");
	else
		error(res, 400, "Twitch Callback Broken.");
});

function loginToTwitch(session, redirect) {
	return new Promise((resolve, reject) => {
		axios.post(`https://id.twitch.tv/oauth2/token?client_id=${twitchcreds.id}&client_secret=${twitchcreds.secret}&code=${session}&grant_type=authorization_code&redirect_uri=${redirect}`).then(result => {
			resolve(result.data);
		}).catch(a => {
			reject(a);
		});
	});
}

function getTwitchUserId(token) {
	return new Promise((resolve, reject) => {
		axios.get("https://api.twitch.tv/helix/users", {
			headers: {
				"Client-Id": twitchcreds.id,
				Authorization: `Bearer ${token}`
			}
		}).then(result => {
			resolve(result.data.data[0].id);
		}).catch(reject);
	});
}

app.get("/api/getaccount/twitch/name/:name", (req, res) => {
	if (typeof (req.params.name) != "undefined")
		getBearerKey().then(creds => {
			axios.get(`https://api.twitch.tv/helix/users?login=${req.params.name}`, {
				headers: {
					Authorization: `Bearer ${creds.access_token}`,
					"Client-Id": twitchcreds.id
				}
			}).then(result => {
				database.getAccount("TWITCH_ID", result.data.data[0].id, "id").then(result => {
					res.status(200).send(result.toString());
				});
			});
		});
});

let bearerKeyCache = null;

function getBearerKey() {
	return new Promise((resolve, reject) => {
		if (bearerKeyCache == null || bearerKeyCache.timestamp < Date.now() + 5000)
			axios.post(`https://id.twitch.tv/oauth2/token?client_id=${twitchcreds.id}&client_secret=${twitchcreds.secret}&grant_type=client_credentials`).then(creds =>
				resolve(bearerKeyCache = {
					access_token: creds.data.access_token,
					timestamp: creds.data.expires_in * 1000 + Date.now()
				})
			).catch(err => {
				console.error(err);
				reject(err);
			});
		else
			resolve(bearerKeyCache);
	});
}

app.get("/api/gettwitchname/:name", (req, res) => {
	if (typeof (req.params.name) != "undefined")
		getBearerKey().then(creds => {
			axios.get(`https://api.twitch.tv/helix/users?id=${req.params.name}`, {
				headers: {
					Authorization: `Bearer ${creds.access_token}`,
					"Client-Id": twitchcreds.id
				}
			}).then(result => {
				res.send(result.data.data[0].display_name);
			});
		}).catch(err => {
			error(res, 500, "Internal Twitch Error.");
		});
});
//#endregion
//#region twitter
const loginOauth = new oauth.OAuth(
	"https://twitter.com/oauth/request_token", "https://twitter.com/oauth/access_token",
	twittercreds.apikey,
	twittercreds.apisecret,
	"1.0A", url + "twittercallback", "HMAC-SHA1");
const addOauth = new oauth.OAuth(
	"https://twitter.com/oauth/request_token", "https://twitter.com/oauth/access_token",
	twittercreds.apikey,
	twittercreds.apisecret,
	"1.0A", url + "twittercallback/add", "HMAC-SHA1");
app.get("/twitterauth/login", twitter("authenticate", loginOauth));
app.get("/twitterauth/add", twitter("authorize", addOauth));

function twitter(method, oauth) {
	return async (req, res) => {
		getOAuthRequestToken(oauth).then(result => {
			const {
				oauthRequestToken,
				oauthRequestTokenSecret
			} = result;
			req.session.twitterOauthRequestToken = oauthRequestToken;
			req.session.twitterOauthRequestTokenSecret = oauthRequestTokenSecret;

			res.redirect(`https://api.twitter.com/oauth/${method}?oauth_token=${oauthRequestToken}`);
		}).catch(err => {
			error(res, 500, "Twitter Error.");
		});
	};
}


function getOAuthAccessTokenWith(
	oauthRequestToken,
	oauthRequestTokenSecret,
	oauthVerifier, oauth) {
	return new Promise((resolve, reject) => {
		oauth.getOAuthAccessToken(oauthRequestToken, oauthRequestTokenSecret, oauthVerifier, function (error, oauthAccessToken, oauthAccessTokenSecret, results) {
			if (error)
				reject(error);
			else
				resolve({
					oauthAccessToken,
					oauthAccessTokenSecret,
					results
				});
		});
	});
}

function twitterCallback(req, res, oauth) {
	return new Promise((resolve, reject) => {
		const {
			twitterOauthRequestToken,
			twitterOauthRequestTokenSecret
		} = req.session;
		const {
			oauth_verifier
		} = req.query;
		getOAuthAccessTokenWith(
			twitterOauthRequestToken,
			twitterOauthRequestTokenSecret,
			oauth_verifier, oauth).then(result => {
			const {
				results
			} = result;
			resolve(results);
		}).catch(err => {
			console.error(err);
			error(res);
		});
	});
}
app.get('/twittercallback', async (req, res) => {
	twitterCallback(req, res, loginOauth).then(user => {
		console.log("Through callback");
		console.log(user);
		database.createAccountWith("twitter_id", user.user_id).then(() => res.redirect("/twitter/" + user.screen_name));
	});
});
app.get('/twittercallback/add', async (req, res) => {
	if (typeof (req.session.userid) !== "undefined")
		twitterCallback(req, res, addOauth).then(user => {
			database.addToAccount("twitter_id", req.session.userid, user.user_id).then(result => {
				res.redirect("/twitter/" + user.screen_name);
			});
		});
});

function getOAuthRequestToken(oauth) {
	return new Promise((resolve, reject) => {
		oauth.getOAuthRequestToken(function (error, oauthRequestToken, oauthRequestTokenSecret, results) {
			if (error) reject(error);
			else
				resolve({
					oauthRequestToken,
					oauthRequestTokenSecret,
					results
				});
		});
	});
}

app.get("/api/gettwittername/:userId", (req, res) => {
	if (!isNaN(req.params.userId)) {
		axios.get(`https://api.twitter.com/1.1/users/show.json?user_id=${req.params.userId}&include_entities=false`, {
			headers: {
				authorization: `Bearer ${twittercreds.bearertoken}`
			}
		}).then(data => {
			res.send(data.data);
		}).catch(() => {
			error(res, 500, "Twitter Error.");
		});
	} else
		error(res, 400, "Invalid Params.");
});
app.get("/api/getaccount/twitter/name/:screenName", (req, res) => {
	if (typeof req.params.screenName !== "undefined") {
		axios.get(`https://api.twitter.com/1.1/users/show.json?screen_name=${req.params.screenName}&include_entities=false`, {
			headers: {
				authorization: `Bearer ${twittercreds.bearertoken}`
			}
		}).then(data => {
			database.getAccount("twitter_id", data.data.id_str, "ID").then(result => res.send(result.toString())).catch(e => {
				console.error(e);
				error(res, 500, "Database Error");
			});
		});
	} else
		error(res, 400, "Invalid Params.");
});


//#endregion
//#region steam
let authlogin = new SteamAuth(url + "steamcallback", url);
let authadd = new SteamAuth(url + "steamcallback/add", url);
app.get("/steamauth/login", (req, res) => {
	authlogin.getAuthUrl().then(url => res.redirect(url)).catch(() => error(res, 500, "Steam Error."));
});
app.get("/steamauth/add", (req, res) => {
	authadd.getAuthUrl().then(url => res.redirect(url)).catch(() => error(res, 500, "Steam Error."));
});
app.get("/steamcallback", (req, res) => {
	authlogin.verify(req).then(steamId => {
		database.createAccountWith("steam_id", steamId).then(userid => {
			req.session.userid = userid;
			console.log(userid + " logged in!");
			res.redirect("/id/" + userid);
		}).catch(err => {
			console.error(err.toString());
			error(res, 500, "Database Errror.");
		});
	}).catch(err => {
		console.error(err);
		error(res, 400, "Steam Authentication Error.");
	});
});
app.get("/steamcallback/add", (req, res) => {
	if (typeof (req.session.userid) !== "undefined")
		authadd.verify(req).then(steamId => {
			database.addToAccount("steam_id", req.session.userid, steamId).then(id => {
				res.redirect("/id/" + req.session.userid);
			});
		}).catch(err => {
			error(res, 400, "Steam Authentication Error.");
		});
});
app.get("/api/getsteamname/:steamid", (req, res) => {
	if (!isNaN(req.params.steamid))
		axios.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamcreds.key}&steamids=${req.params.steamid}`).then(result => res.send(result.data.response.players[0])).catch(err => console.error(err));
});
//#endregion
//#region embed
function getData(from, name) {
	return new Promise((resolve, reject) => {
		switch (from) {
			case "github":
				axios.get("https://api.github.com/users/" + name, {
					auth: ghcreds.tokenauth
				}).then(userdata => {
					userdata.data.name = userdata.data.name;
					userdata.data.html_url = userdata.data.html_url;
					userdata.data.picture = userdata.data.avatar_url;
					database.getUser("github_id", userdata.data.id).then(result => resolve({
						dbdata: result,
						userdata: {
							"GITHUB_ID": userdata.data
						}
					})).catch(e => reject("Uh Oh!"));
				}).catch(err => {
					console.error(err);
					reject("GitHub Error.");
				});
				break;
			case "ghid":
				if (isNaN(name))
					reject("Invalid ID.");
				else
					database.getUser("GITHUB_ID", name).then(user => {
						if (typeof user === "undefined")
							reject("This person doesn't have a movr account!");
						else
							resolve({
								dbdata: user
							});
					}).catch(e => reject("Database Error"));
				break;
			case "twitch":
				getBearerKey().then(creds => {
					axios.get(`https://api.twitch.tv/helix/users?login=${name}`, {
						headers: {
							Authorization: `Bearer ${creds.access_token}`,
							"Client-Id": twitchcreds.id
						}
					}).then(result => {
						result.data.data[0].name = result.data.data[0].display_name;
						result.data.data[0].html_url = "https://twitch.tv/" + result.data.data[0].login;
						result.data.data[0].picture = result.data.data[0].profile_image_url;
						database.getUser("TWITCH_ID", result.data.data[0].id).then(user => {
							if (typeof user === "undefined")
								reject("This person doesn't have a movr account!");
							else
								resolve({
									dbdata: user,
									userdata: {
										"TWITCH_ID": result.data.data[0]
									}
								});
						}).catch(err => {
							console.error(err);
							error("Database Error.");
						});
					}).catch(err => reject(err));
				}).catch(err => console.error(err));

				break;
			case "twitter":
				axios.get(`https://api.twitter.com/1.1/users/show.json?screen_name=${name}&include_entities=false`, {
					headers: {
						authorization: `Bearer ${twittercreds.bearertoken}`
					}
				}).then(data => {
					data.data.html_url = "https://twitter.com/" + data.data.screen_name;
					data.data.picture = data.data.profile_image_url_https.replace("_normal", "");
					data.data.entities = {};
					database.getUser("TWITTER_ID", data.data.id_str).then(result => resolve({
						dbdata: result,
						userdata: {
							"TWITTER_ID": data.data
						}
					})).catch(e => reject("Uh Oh!"));
				}).catch(err => {
					console.error(err);
					reject("Twitter Error.");
				});
				break;
			case "steam":
				axios.get(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${steamcreds.key}&vanityurl=${name}&url_type=1`).then(data => {
					if (data.data.response.success === 1) {
						axios.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamcreds.key}&steamids=${data.data.response.steamid}`)
							.then(result => {
								database.getUser("STEAM_ID", result.data.response.players[0].steamid).then(user => {
									if (typeof user === "undefined")
										reject("This person doesn't have a movr account!");
									else {
										result.data.response.players[0].name = result.data.response.players[0].personaname;
										result.data.response.players[0].html_url = result.data.response.players[0].profileurl;
										result.data.response.players[0].picture = result.data.response.players[0].avatarfull;
										resolve({
											dbdata: user,
											userdata: {
												"STEAM_ID": result.data.response.players[0]
											}
										});
									}
								}).catch(err => {
									console.error(err);
									error("Database Error.");
								});
							})
							.catch(err => reject("Steam Errror."));
					} else if (data.data.response.success === 42)
						reject("This account doesn't exist.");
					else
						reject("Steam Error.");
				});
				break;
			case "id":
				if (isNaN(name))
					reject("Invalid ID.");
				else
					database.getUser("ID", name).then(user => {
						if (typeof user === "undefined")
							reject("This person doesn't have a movr account!");
						else
							resolve({
								dbdata: user
							});
					}).catch(e => reject("Database Error"));
				break;
			default:
				reject("Method Not Found");
				break;
		}
	});
}

let sortStyle = ["GITHUB_ID", "TWITTER_ID", "DISCORD_ID", "TWITCH_ID", "STEAM_ID"];

function getProfile(dbdata, userdata) {
	return new Promise((resolve, reject) => {
		if (typeof userdata !== "undefined")
			resolve(userdata);
		else
			for (let sort of sortStyle) {
				let id = dbdata[sort];
				if (id != null) {
					switch (sort) {
						case "GITHUB_ID":
							axios.get("https://api.github.com/user/" + id, {
								auth: ghcreds.tokenauth
							}).then(result => {
								let finalObject = {};
								finalObject[sort] = {
									name: result.data.name,
									html_url: result.data.html_url,
									picture: result.data.avatar_url
								};
								resolve(finalObject);
							}).catch(err => {
								let finalObject = {};
								finalObject[sort] = {
									name: "try again later",
									picture: url + "favicon.png"
								};
								resolve(finalObject);
							});
							break;
						case "TWITTER_ID":
							axios.get(`https://api.twitter.com/1.1/users/show.json?user_id=${id}&include_entities=false`, {
								headers: {
									authorization: `Bearer ${twittercreds.bearertoken}`
								}
							}).then(result => {
								let finalObject = {};
								finalObject[sort] = {
									name: result.data.name,
									html_url: "https://twitter.com/" + result.data.screen_name,
									picture: result.data.profile_image_url_https
								};
								resolve(finalObject);
							});
							break;
						case "DISCORD_ID":
							axios.get(`https://discord.com/api/v8/users/${id}`, {
								headers: {
									Authorization: `Bot ${discordcreds.bot}`
								}
							}).then(result => {
								let finalObject = {};
								finalObject[sort] = {
									name: result.data.username + "#" + result.data.discriminator,
									picture: `https://cdn.discordapp.com/avatars/${result.data.id}/${result.data.avatar}.png`
								};
								resolve(finalObject);
							});
							break;
						case "TWITCH_ID":
							getBearerKey().then(creds =>
								axios.get(`https://api.twitch.tv/helix/users?id=${id}`, {
									headers: {
										Authorization: `Bearer ${creds.access_token}`,
										"Client-Id": twitchcreds.id
									}
								}).then(result => {
									let finalObject = {};
									finalObject[sort] = {
										name: result.data.display_name,
										html_url: "https://twitch.tv/" + result.data.login,
										picture: result.data.profile_image_url
									};
									resolve(finalObject);
								})
							);
							break;
						case "STEAM_ID":
							axios.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamcreds.key}&steamids=${id}`)
								.then(result => {
									let finalObject = {};
									finalObject[sort] = {
										name: result.data.response.players[0].personaname,
										html_url: result.data.response.players[0].profileurl,
										picture: result.data.response.players[0].avatarfull
									};
									resolve(finalObject);
								})
								.catch(err => reject("Steam Errror."));
							break;
						default:
							resolve({});
							break;
					}
					break;
				}
			}
	});
}
//#endregion

// This HAS to be last so it doesn't override any other (api) urls.
app.get('/:from/:name', (req, res) => {
	const from = req.params.from;
	const name = req.params.name;
	getData(from, name).then(data => {
		if (typeof data.dbdata === "undefined")
			error(res, 404, "This account type isn't supported.");
		else
			getProfile(data.dbdata, data.userdata).then(result => {
				res.render("person.ejs", {
					from: req.params.from,
					name: req.params.name,
					sessionuserid: req.session.userid,
					discordid: discordcreds.id,
					ghid: ghcreds.id,
					twitchid: twitchcreds.id,
					ids: data.dbdata || {},
					precachedaccount: result,
					url
				});
			});
	}).catch(err => {
		if (typeof err === "string")
			error(res, 500, err);
	});
});
app.get("*", (_, res) => error(res, 404, "Page Not Found!"));

app.listen(port, () => console.log(`Movr listening on port ${port}!`));
process.on('exit', function () {
	db.closeSync();
});