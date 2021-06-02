const ibmdb = require("ibm_db");
const express = require('express');
const axios = require("axios").default;
const oauth = require("oauth");
const app = express();
const port = process.env.PORT || 3000;
const ghcreds = require("./ghclientcreds.json");
const discordcreds = require("./discordcreds.json");
const twitchcreds = require("./twitchcreds.json");
const twittercreds = require("./twittercreds.json");

let db2;
let testingenv = false;
let discordredirect = "https%3A%2F%2Fmovr.eu-gb.mybluemix.net%2Fdiscordcallback";
let discordredirectadd = "https%3A%2F%2Fmovr.eu-gb.mybluemix.net%2Fdiscordcallbackadd";
let githubredirect = "https://movr.eu-gb.mybluemix.net/ghcallback";
let twitchredirect = "https://movr.eu-gb.mybluemix.net/twitchcallback";
let url = "https://movr.eu-gb.mybluemix.net/";
if (process.env.VCAP_SERVICES) {
	let env = JSON.parse(process.env.VCAP_SERVICES);
	if (env.dashDB)
		db2 = env.dashDB[0].credentials;
	else if (env["dashDB For Transactions"])
		db2 = env["dashDB For Transactions"][0].credentials;
	else
		console.log(env);
} else {
	testingenv = true;
	discordredirect = "http%3A%2F%2Flocalhost%3A3000%2Fdiscordcallback";
	discordredirectadd = "http%3A%2F%2Flocalhost%3A3000%2Fdiscordcallbackadd";
	githubredirect = "http://localhost:3000/ghcallback";
	twitchredirect = "http://localhost:3000/twitchcallback";
	url = "http://localhost:3000/";
	db2 = require("./db2creds.json");
}

let connString = `DRIVER={DB2};DATABASE=${db2.db};HOSTNAME=${db2.hostname};UID=${db2.username};PWD=${db2.password};PORT=${db2.port+1};PROTOCOL=TCPIP;Security=SSL;`;
console.log(`Connecting to database with hostname ${db2.hostname}...`);
let db = ibmdb.openSync(connString);
console.log("Connected!");

app.set('view engine', 'ejs');
app.set('views', 'views');
app.use(express.static("public"));
app.use(require("express-session")({
	secret: Math.random().toString(),
	resave: () => {},
	saveUninitialized: () => {},
	sameSite: "lax"
}));


app.get('/', (req, res) => {
	res.render('index', {
		ghid: ghcreds.id,
		discordid: discordcreds.id,
		discordredirect,
		githubredirect,
		twitchredirect,
		twitchid: twitchcreds.id
	});
});

// #region API: Get accounts
app.get("/api/getaccount/gh/:id", (req, res) => {
	let id = req.params.id;
	if (!isNaN(id))
		db.query(`select id from movr_users where github_id=${id} limit 1`).then(result => res.send(result[0].ID.toString())).catch(e => console.error(e));
});
app.get("/api/getaccount/:id", (req, res) => {
	let id = req.params.id;
	if (!isNaN(id))
		db.query(`select * from movr_users where id=${id} limit 1`).then(result => {
			res.send(result[0]);
		}).catch(e => console.error(e));
});

app.get("/deleteaccount", (req, res) => {
	if (!isNaN(req.session.userid))
		db.query(`delete from movr_users where id=${req.session.userid} limit 1`).catch(e => console.error(e));
});
// #endregion


//#region general
function createAccountWith(type, id, str = false) {
	if (str)
		id = "'" + id + "'";
	return new Promise((resolve, reject) => {
		// Existing check
		db.query(`select id from movr_users where ${type}=${id} limit 1`).then(result => {
			if (result.length > 0)
				return resolve(result[0].ID);
			// Create account
			db.query(`insert into movr_users (${type}) values (${id})`).then(result => {
				// Get account id
				db.query(`select id from movr_users where ${type}=${id} limit 1`).then(id => {
					resolve(id[0].ID);
				}).catch(e => console.error(e));
			}).catch(e => console.error(e));
		}).catch(error => {
			console.error(error);
			res.redirect("/");
		});
	});
}

function addToAccount(type, movrid, id, str = false) {
	return new Promise((resolve, reject) => {
		db.query(`delete from movr_users where ${type}=${id}`).then(() => {
			db.query(`update movr_users set ${type}=${id} where id=${movrid} limit 1`).then(result => {
				resolve(result);
			}).catch(e => {
				console.error(e);
				reject(e);
			});
		}).catch(e => {
			console.error(e);
			reject(e);
		});
	});
}
//#endregion
//#region github
app.get("/ghcallback", async (req, res) => {
	let code = req.query.code;
	if (code)
		loginToGithub(code, githubredirect).then(session => {
			req.session.ghtoken = session.access_token;
			getGithubUserId(session.access_token).then(id => {
				createAccountWith("github_id", id).then(userid => {
					req.session.userid = userid;
					console.log(userid + " logged in!");
					res.redirect("/id/" + userid);
				}).catch(error => {
					console.error(error.toString());
					res.redirect("/");
				});
			}).catch(error => {
				console.error(error.toString());
				res.redirect("/");
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
					addToAccount("github_id", req.session.userid, id).then(() => {
						res.redirect("/id/" + req.session.userid);
					}).catch(error => {
						console.error(error.toString());
						res.redirect("/shit");
					});
				}).catch(error => {
					console.error(error.toString());
					res.redirect("/fuck");
				});
			}).catch(a => {
				res.send(JSON.stringify(a, null, ". . . ").replace(/\n/g, "<br>"));
			});
		else
			res.redirect("/kut");
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
		loginToDiscord(code, discordredirect).then(session => {
			req.session.discordtoken = session.access_token;
			getDiscordUserId(session.access_token).then(id => {
				createAccountWith("discord_id", id, true).then(userid => {
					req.session.userid = userid;
					console.log(userid + " logged in!");
					res.redirect("/id/" + userid);
				}).catch(error => {
					console.error(error.toString());
					res.redirect("/");
				});
			}).catch(error => {
				console.error(error.toString());
				res.redirect("/");
			});
		}).catch(a => {
			console.error("189" + a.toString());
			res.send(JSON.stringify(a, null, ". . . ").replace(/\n/g, "<br>"));
		});
	else
		res.redirect("/");
});

function loginToDiscord(session, redirect) {
	return new Promise((resolve, reject) => {
		let data = `client_id=${discordcreds.id}&client_secret=${discordcreds.secret}&grant_type=authorization_code&code=${session}&redirect_uri=${redirect}&scope=identify`;
		axios.post("https://discord.com/api/v8/oauth2/token", data, {
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			}
		}).then(result => {
			// // Refresh? Probably not necessary but I'll keep it commented in case it is.
			// axios.post("https://discord.com/api/oauth2/token", {
			// 	client_id: discordcreds.id,
			// 	client_secret: discordcreds.secret,
			// 	refresh_token: result.data.refresh_token,
			// 	grant_type: "refresh_token"
			// }).then(result => {
			resolve(result.data);
			// }).catch(a => {
			// 	reject(a);
			// });
		}).catch(a => {
			console.error("214" + a.toString());
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
			loginToDiscord(code, discordredirectadd).then(session => {
				req.session.discordtoken = session.access_token;
				getDiscordUserId(session.access_token).then(id => {
					addToAccount("discord_id", req.session.userid, id, true).then(userid => {
						res.redirect("/id/" + req.session.userid);
					}).catch(error => {
						console.error(error.toString());
						res.redirect("/shit");
					});
				}).catch(error => {
					console.error(error.toString());
					res.redirect("/fuck");
				});
			}).catch(a => {
				res.send(JSON.stringify(a, null, ". . . ").replace(/\n/g, "<br>"));
			});
		else
			res.redirect("/kut");
	else
		res.redirect("/tering");
});

app.get("/getdiscordname/:discordid", (req, res) => {
	if (!isNaN(req.params.discordid)) {
		axios.get(`https://discord.com/api/v8/users/${req.params.discordid}`, {
			headers: {
				Authorization: `Bot ${discordcreds.bot}`
			}
		}).then(result => {
			res.send(result.data.username + "#" + result.data.discriminator);
		});
	}
});


//#endregion
//#region twitch
app.get("/twitchcallback", async (req, res) => {
	let code = req.query.code;
	if (code)
		loginToTwitch(code, twitchredirect).then(session => {
			req.session.twitchtoken = session.access_token;
			getTwitchUserId(session.access_token).then(id => {
				createAccountWith("twitch_id", id).then(userid => {
					req.session.userid = userid;
					console.log(userid + " logged in!");
					res.redirect("/id/" + userid);
				}).catch(error => {
					console.error(error.toString());
					res.redirect("/");
				});
			}).catch(error => {
				console.error(error.toString());
				res.redirect("/");
			});
		});
	else
		res.redirect("/");
});
app.get("/twitchcallback/add", async (req, res) => {
	let code = req.query.code;
	if (code)
		if (typeof (req.session.userid) !== "undefined")
			loginToTwitch(code, twitchredirect + "/add").then(session => {
				req.session.twitchtoken = session.access_token;
				getTwitchUserId(session.access_token).then(id => {
					addToAccount("twitch_id", req.session.userid, id).then(() => {
						res.redirect("/id/" + req.session.userid);
					}).catch(error => {
						console.error(error.toString());
						res.redirect("/shit");
					});
				}).catch(error => {
					console.error(error.toString());
					res.redirect("/fuck");
				});
			}).catch(a => {
				res.send(JSON.stringify(a, null, ". . . ").replace(/\n/g, "<br>"));
			});
		else
			res.redirect("/kut");
	else
		res.redirect("/");
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
		axios.post(`https://id.twitch.tv/oauth2/token?client_id=${twitchcreds.id}&client_secret=${twitchcreds.secret}&grant_type=client_credentials`).then(creds => {
			axios.get(`https://api.twitch.tv/helix/users?login=${req.params.name}`, {
				headers: {
					Authorization: `Bearer ${creds.data.access_token}`,
					"Client-Id": twitchcreds.id
				}
			}).then(result => {
				db.query(`select id from movr_users where twitch_id=${result.data.data[0].id} limit 1`).then(result => {
					res.status(200).send(result[0].ID.toString());
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
				})).catch(reject);
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
				db.query(`select id from movr_users where twitch_id=${result.data.data[0].id} limit 1`).then(result => {
					res.send(result[0]);
				});
			});
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

			const authorizationUrl = `https://api.twitter.com/oauth/${method}?oauth_token=${oauthRequestToken}`;
			console.log("redirecting user to ", authorizationUrl);
			res.redirect(authorizationUrl);
		}).catch(error => res.send(JSON.stringify(error)));
	};
}


function getOAuthAccessTokenWith(
	oauthRequestToken,
	oauthRequestTokenSecret,
	oauthVerifier, oauth) {
	return new Promise((resolve, reject) => {
		oauth.getOAuthAccessToken(oauthRequestToken, oauthRequestTokenSecret, oauthVerifier, function (error, oauthAccessToken, oauthAccessTokenSecret, results) {
			return error ?
				reject(error) :
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
			oauth_verifier: oauthVerifier
		} = req.query;
		getOAuthAccessTokenWith(
			twitterOauthRequestToken,
			twitterOauthRequestTokenSecret,
			oauthVerifier, oauth).then(result => {
			const {
				oauthAccessToken,
				oauthAccessTokenSecret,
				results
			} = result;
			req.session.oauthAccessTokenSecret = oauthAccessTokenSecret;
			req.session.oauthAccessToken = oauthAccessToken;
			resolve(results);
		}).catch(error => res.send(JSON.stringify(error)));
	});
}
app.get('/twittercallback', async (req, res) => {
	twitterCallback(req, res, loginOauth).then(user => {
		createAccountWith("twitter_id", user.user_id).then(() => res.redirect("/twitter/" + user.screen_name));
	});
});
app.get('/twittercallback/add', async (req, res) => {
	if (typeof (req.session.userid) !== "undefined")
		twitterCallback(req, res, addOauth).then(user => {
			addToAccount("twitter_id", req.session.userid, user.user_id).then(result => {
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
		loginOauth.get(`https://api.twitter.com/1.1/users/show.json?user_id=${req.params.userId}`, twittercreds.accesstoken, twittercreds.accesstokensecret, (e, data, r) => {
			if (e)
				res.send(JSON.stringify(e));
			else
				res.send(data);
		});
	} else
		res.status(400).send();
});
app.get("/api/getaccount/twitter/name/:screenName", (req, res) => {
	if (typeof req.params.screenName !== "undefined") {
		axios.get(`https://api.twitter.com/1.1/users/show.json?screen_name=${req.params.screenName}`, {
			headers: {
				authorization: `Bearer ${twittercreds.bearertoken}`
			}
		}).then(data => {
			db.query(`select id from movr_users where twitter_id='${data.data.id_str}' limit 1`).then(result => res.send(result[0].ID.toString())).catch(e => console.error(e));
		});
	} else
		res.status(400).send();
});


//#endregion
// This HAS to be last so it doesn't override any other (api) urls.
app.get('/:from/:name', (req, res) => {
	res.render('person', {
		from: req.params.from,
		name: req.params.name,
		sessionuserid: req.session.userid,
		discordid: discordcreds.id,
		discordredirectadd,
		ghid: ghcreds.id,
		githubredirect,
		twitchredirect,
		twitchid: twitchcreds.id
	});
});

app.listen(port, () => console.log(`Movr listening on port ${port}!`));
process.on('exit', function () {
	db.closeSync();
});