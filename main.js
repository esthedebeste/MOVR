const ibmdb = require("ibm_db");
const express = require('express');
const axios = require("axios").default;
const app = express();
const port = process.env.PORT || 3000;
const ghcreds = require("./ghclientcreds.json");
const discordcreds = require("./discordcreds.json");
const twitchcreds = require("./twitchcreds.json");

let db2;
let testingenv = false;
let discordredirect = "https%3A%2F%2Fmovr.eu-gb.mybluemix.net%2Fdiscordcallback";
let discordredirectadd = "https%3A%2F%2Fmovr.eu-gb.mybluemix.net%2Fdiscordcallbackadd";
let githubredirect = "https://movr.eu-gb.mybluemix.net/ghcallback";
let twitchredirect = "https://movr.eu-gb.mybluemix.net/twitchcallback";
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
	saveUninitialized: () => {}
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
app.get('/gh/:name', (req, res) => {
	res.render('person', {
		from: "gh",
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
app.get('/ghid/:name', (req, res) => {
	res.render('person', {
		from: "ghid",
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
app.get('/twitch/:name', (req, res) => {
	res.render('person', {
		from: "twitch",
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
app.get('/id/:name', (req, res) => {
	res.render('person', {
		from: "id",
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

// #region API: Get accounts
app.get("/api/getaccount/gh/:id", (req, res) => {
	let id = req.params.id;
	if (!isNaN(id))
		db.query(`select id from movr_users where github_id=${id} limit 1`).then(result => res.send(result[0].ID.toString())).catch(e => console.error({
			e,
			line: 93
		}));
});
app.get("/api/getaccount/:id", (req, res) => {
	let id = req.params.id;
	if (!isNaN(id))
		db.query(`select discord_id, github_id, twitch_id from movr_users where id=${id} limit 1`).then(result => {
			res.send(result[0]);
		}).catch(e => console.error({
			e,
			line: 103
		}));
});

app.get("/deleteaccount", (req, res) => {
	if (!isNaN(req.session.userid))
		db.query(`delete from movr_users where id=${req.session.userid} limit 1`).catch(e => console.error({
			e,
			line: 111
		}));
});
// #endregion

//#region github
app.get("/ghcallback", async (req, res) => {
	let code = req.query.code;
	if (code)
		loginToGithub(code, githubredirect).then(session => {
			req.session.ghtoken = session.access_token;
			getGithubUserId(session.access_token).then(id => {
				createAccountWithGH(id).then(userid => {
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
					addGHToAccount(req.session.userid, id).then(() => {
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

function createAccountWithGH(github_id) {
	return new Promise((resolve, reject) => {
		// Existing check
		db.query(`select id from movr_users where github_id=${github_id} limit 1`).then(result => {
			if (result.length > 0)
				return resolve(result[0].ID);
			// Create account
			db.query(`insert into movr_users (github_id) values (${github_id})`).then(result => {
				// Get account id
				db.query(`select id from movr_users where github_id=${github_id} limit 1`).then(id => {
					resolve(id[0].ID);
				}).catch(e => console.error({
					e,
					line: 211
				}));
			}).catch(e => console.error({
				e,
				line: 215
			}));
		}).catch(error => {
			console.error({
				e: error,
				line: 218
			});
			res.redirect("/");
		});
	});
}

function addGHToAccount(id, github_id) {
	return new Promise((resolve, reject) => {
		db.query(`delete from movr_users where github_id=${github_id}`).then(() => {
			db.query(`update movr_users set github_id=${github_id} where id=${id} limit 1`).then(result => {
				resolve(result);
			}).catch(e => {
				console.error({
					e,
					line: 91
				});
				reject(e);
			});
		}).catch(e => {
			console.error({
				e,
				line: 91
			});
			reject(e);
		});
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
				createAccountWithDiscord(id).then(userid => {
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

function createAccountWithDiscord(discord_id) {
	return new Promise((resolve, reject) => {
		// Existing check
		db.query(`select id from movr_users where discord_id='${discord_id}' limit 1`).then(result => {
			if (result.length > 0)
				return resolve(result[0].ID);
			// Create account
			db.query(`insert into movr_users (discord_id) values ('${discord_id}')`).then(result => {
				// Get account id
				db.query(`select id from movr_users where discord_id='${discord_id}' limit 1`).then(id => {
					resolve(id[0].ID);
				});
			});
		}).catch(error => {
			console.error(error.toString());
			res.redirect("/");
		});
	});
}

app.get("/discordcallbackadd", (req, res) => {
	let code = req.query.code;
	if (code)
		if (typeof (req.session.userid) !== "undefined")
			loginToDiscord(code, discordredirectadd).then(session => {
				req.session.discordtoken = session.access_token;
				getDiscordUserId(session.access_token).then(id => {
					addDiscordToAccount(req.session.userid, id).then(userid => {
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

function addDiscordToAccount(id, discord_id) {
	return new Promise((resolve, reject) => {
		db.query(`delete from movr_users where discord_id='${discord_id}'`).then(() => {
			db.query(`update movr_users set discord_id='${discord_id}' where id=${id} limit 1`).then(result => {
				resolve(result);
			}).catch(error => {
				console.error(error.toString());
				reject(error);
			});
		}).catch(error => {
			console.error(error.toString());
			reject(error);
		});
	});
}


//#endregion

//#region twitch
app.get("/twitchcallback", async (req, res) => {
	let code = req.query.code;
	if (code)
		loginToTwitch(code, twitchredirect).then(session => {
			req.session.twitchtoken = session.access_token;
			getTwitchUserId(session.access_token).then(id => {
				createAccountWithTwitch(id).then(userid => {
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
					addTwitchToAccount(req.session.userid, id).then(() => {
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

function createAccountWithTwitch(twitch_id) {
	return new Promise((resolve, reject) => {
		// Existing check
		db.query(`select id from movr_users where twitch_id=${twitch_id} limit 1`).then(result => {
			if (result.length > 0)
				return resolve(result[0].ID);
			// Create account
			db.query(`insert into movr_users (twitch_id) values (${twitch_id})`).then(result => {
				// Get account id
				db.query(`select id from movr_users where twitch_id=${twitch_id} limit 1`).then(id => {
					resolve(id[0].ID);
				}).catch(e => console.error({
					e,
					line: 211
				}));
			}).catch(e => console.error({
				e,
				line: 215
			}));
		}).catch(error => {
			console.error({
				e: error,
				line: 218
			});
			res.redirect("/");
		});
	});
}

function addTwitchToAccount(id, twitch_id) {
	return new Promise((resolve, reject) => {
		db.query(`delete from movr_users where twitch_id=${twitch_id}`).then(() => {
			db.query(`update movr_users set twitch_id=${twitch_id} where id=${id} limit 1`).then(result => {
				resolve(result);
			}).catch(e => {
				console.error({
					e,
					line: 91
				});
				reject(e);
			});
		}).catch(e => {
			console.error({
				e,
				line: 91
			});
			reject(e);
		});
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

app.listen(port, () => console.log(`Movr listening on port ${port}!`));
process.on('exit', function () {
	db.closeSync();
});