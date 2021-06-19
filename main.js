import json from "./jsonimport.js";
import ax from "axios";
import oauth from "oauth";
import session from "express-session";
import crypto from "crypto";
import { App } from "@tinyhttp/app";
import sirv from "sirv";
import ejs from "ejs";
import SteamAuth from "@tbhmens/steam-auth";
import Database from "./db2.js";
import TwitchAuth from "@tbhmens/twitch-auth";
import { YoutubeAuth } from "@tbhmens/google-auth";
const axios = ax.create({
  headers: {
    "User-Agent": "MOVR",
  },
});
const app = new App({
  onError: (err, _, res) => {
    console.error(err);
    if (err instanceof Error) error(res, 500, err.name);
    else error(res, 500, "Internal Server Error.");
  },
  noMatchHandler: (_, res) => error(res, 404, "Page Not Found!"),
  settings: {
    xPoweredBy: false,
    freshnessTesting: true,
  },
});
const port = process.env.PORT || 80;
const ghcreds = json("config/ghclientcreds.json");
const discordcreds = json("config/discordcreds.json");
const twitchcreds = json("config/twitchcreds.json");
const twittercreds = json("config/twittercreds.json");
const steamcreds = json("config/steamcreds.json");
const googlecreds = json("config/googlecreds.json");
const movrconfig = json("config/movrconfig.json");

let testingenv = process.env.LOCALTESTINGENVIRONMENT === "T";
// Format to a valid URL which ends with a /
let url = new URL(movrconfig.url).toString();
if (testingenv) url = "http://localhost/";

const db2config = json("config/db2config.json");
let database = new Database(db2config.tablename, testingenv);

app.engine("ejs", ejs.renderFile);
app.set("ext", "ejs");
app.use(sirv("public"));
app.use(
  session({
    secret: crypto.randomBytes(64).toString("utf16le"),
    resave: false,
    saveUninitialized: false,
    sameSite: "strict",
    name: "movr-sid",
    cookie: {
      httpOnly: true,
    },
  })
);

/**
 * Sends error.ejs to the client with the specified error text
 * @param {Request} res
 * @param {number} code
 * @param {string} errtext
 */
function error(res, code = 500, errtext = "Internal Error.") {
  res.status(code).render("error.ejs", {
    error: errtext,
  });
}

app.get("/", (req, res) => {
  res.render("index.ejs", {
    ghid: ghcreds.id,
    discordid: discordcreds.id,
    twitchid: twitchcreds.id,
    url,
  });
});

//#region Unused
// Unused, but convenient for people that want to integrate movr
app.get("/api/getaccount/", (req, res) => {
  let id = req.query.id;
  if (!isNaN(req.query.gh))
    database
      .getAccount("github_id", req.query.gh, "ID")
      .then((result) => res.send(result))
      .catch((e) => console.error(e));
  else if (!isNaN(id))
    database
      .getUser("ID", id)
      .then((user) => res.send(user))
      .catch((e) => console.error(e));
  else error(res, 400, "Invalid Query.");
});

// Unused, but as there isn't a delete account method yet this'll have to do.
app.post("/api/deleteaccount", (req, res) => {
  if (!isNaN(req.session.userid))
    db.query(
      `delete from movr_users where id=${req.session.userid} limit 1`
    ).catch((e) => console.error(e));
});
//#endregion
//#region github
app.get("/auth/github/login", async (req, res) => {
  let code = req.query.code;
  if (code)
    loginToGithub(code).then((session) => {
      getGithubUserId(session.access_token)
        .then((id) => {
          database
            .createAccountWith("github_id", id)
            .then((userid) => {
              req.session.userid = userid;
              console.log(userid + " logged in!");
              res.redirect("/id/" + userid);
            })
            .catch((err) => {
              console.error(err.toString());
              error(res, 500, "Database Error.");
            });
        })
        .catch((err) => {
          console.error(err.toString());
          error(res, 500, "GitHub Error.");
        });
    });
  else res.redirect("/");
});
app.get("/auth/github/add", async (req, res) => {
  let code = req.query.code;
  if (code)
    if (typeof req.session.userid !== "undefined")
      loginToGithub(code)
        .then((session) => {
          getGithubUserId(session.access_token)
            .then((id) => {
              database
                .addToAccount("github_id", req.session.userid, id)
                .then(() => {
                  res.redirect("/id/" + req.session.userid);
                })
                .catch((err) => {
                  console.error(err.toString());
                  error(res, 500, "Database Error.");
                });
            })
            .catch((err) => {
              console.error(err.toString());
              error(res, 500, "GitHub Error.");
            });
        })
        .catch((a) => {
          res.send(JSON.stringify(a, null, ". . . ").replace(/\n/g, "<br>"));
        });
    else error(res, 400, "You need to be logged in.");
  else res.redirect("/");
});

/**
 *
 * @param {string} code - Code for authentication
 * @returns {Promise<string>} GitHub Access token
 */
function loginToGithub(code) {
  return new Promise((resolve, reject) => {
    axios
      .post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: ghcreds.id,
          client_secret: ghcreds.secret,
          code,
        },
        {
          headers: {
            Accept: "application/json",
          },
        }
      )
      .then((result) => {
        resolve(result.data);
      })
      .catch((a) => {
        reject(a);
      });
  });
}

/**
 * https://docs.github.com/en/rest/reference/users#get-the-authenticated-user
 * @param {string} token - GitHub access token
 * @returns {Promise<object>} GitHub user profile
 */
function getGithubUserId(token) {
  return new Promise((resolve, reject) => {
    axios
      .get("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((result) => {
        resolve(result.data.id);
      })
      .catch(reject);
  });
}

//#endregion
//#region discord
app.get("/auth/discord/login", async (req, res) => {
  let code = req.query.code;
  if (code)
    loginToDiscord(code, url + "auth/discord/login")
      .then((session) => {
        getDiscordUserId(session.access_token)
          .then((id) => {
            database
              .createAccountWith("discord_id", id)
              .then((userid) => {
                req.session.userid = userid;
                console.log(userid + " logged in!");
                res.redirect("/id/" + userid);
              })
              .catch((err) => {
                console.error(err.toString());
                error(res, 500, "Database Error.");
              });
          })
          .catch((err) => {
            console.error(err.toString());
            error(res, 500, "Discord Error.");
          });
      })
      .catch((a) => {
        console.error(a.toString());
        error(res, 500);
      });
  else error(res, "Discord Callback Broken.");
});

/**
 *
 * @param {string} code - Code from the discord redirect
 * @param {string} redirect  - The discord redirect URI
 * @returns {Promise<object>} A discord token
 */
function loginToDiscord(code, redirect) {
  return new Promise((resolve, reject) => {
    let data = `client_id=${discordcreds.id}&client_secret=${discordcreds.secret}&grant_type=authorization_code&code=${code}&redirect_uri=${redirect}&scope=identify`;
    axios
      .post("https://discord.com/api/v8/oauth2/token", data, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })
      .then((result) => {
        resolve(result.data);
      })
      .catch((a) => {
        reject(a);
      });
  });
}

/**
 * Get the currently logged in user's id
 * @param {string} token - Discord Bearer token (Not the bot token!)
 * @returns {Promise<number>} Discord ID
 */
function getDiscordUserId(token) {
  return new Promise((resolve, reject) => {
    axios
      .get("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((result) => {
        resolve(result.data.id);
      })
      .catch(reject);
  });
}

app.get("/auth/discord/add", (req, res) => {
  let code = req.query.code;
  if (code)
    if (typeof req.session.userid !== "undefined")
      loginToDiscord(code, url + "auth/discord/add")
        .then((session) => {
          getDiscordUserId(session.access_token)
            .then((id) => {
              database
                .addToAccount("discord_id", req.session.userid, id)
                .then((userid) => {
                  res.redirect("/id/" + req.session.userid);
                })
                .catch((err) => {
                  console.error(err.toString());
                  error(res, 500, "Database Error.");
                });
            })
            .catch((err) => {
              console.error(err.toString());
              error(res, 500, "Discord Error.");
            });
        })
        .catch((a) => {
          console.error(a);
          error(res, 500);
        });
    else error(res, 401, "Log in first!");
  else error(res, 400, "Discord Callback Broken!");
});

app.get("/api/discord/getname", (req, res) => {
  if (!isNaN(req.query.id)) {
    axios
      .get(`https://discord.com/api/v8/users/${req.query.id}`, {
        headers: {
          Authorization: `Bot ${discordcreds.bot}`,
        },
      })
      .then((result) => {
        res.send(result.data.username + "#" + result.data.discriminator);
      })
      .catch(() => {
        res.send("ERROR!");
      });
  } else error(res, 400, "Error.");
});

//#endregion
//#region twitch
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
app.get("/redirect/twitch/login", (req, res) =>
  twitchLogin.getAuthUrl(true, {}, req.session).then((url) => res.redirect(url))
);
app.get("/redirect/twitch/add", (req, res) => {
  if (typeof req.session.userid === "undefined")
    return error(res, 401, "Log In First!");
  twitchAdd.getAuthUrl(true, {}, req.session).then((url) => res.redirect(url));
});
app.get("/auth/twitch/login", async (req, res) => {
  twitchLogin
    .verify(req.query, req.session)
    .then((data) => {
      database
        .createAccountWith("twitch_id", data.sub)
        .then((userid) => {
          req.session.userid = userid;
          console.log(userid + " logged in!");
          res.redirect("/id/" + userid);
        })
        .catch((err) => {
          console.error(err.toString());
          error(res, 500, "Database Errror.");
        });
    })
    .catch((err) => {
      console.error(err);
      error(res, 500, "Authentication Error.");
    });
});
app.get("/auth/twitch/add", async (req, res) => {
  if (typeof req.session.userid === "undefined")
    return error(res, 401, "Log In First!");
  twitchLogin
    .verify(req.query, req.session)
    .then((data) => {
      database
        .addToAccount("twitch_id", data.sub)
        .then(() => {
          console.log(userid + " logged in!");
          res.redirect("/id/" + userid);
        })
        .catch((err) => {
          console.error(err.toString());
          error(res, 500, "Database Errror.");
        });
    })
    .catch((err) => {
      console.error(err);
      error(res, 500, "Authentication Error.");
    });
});
let bearerKeyCache = null;

/**
 * Gets an application bearer key using the cache
 * @returns {Promise<{
 * 	access_token: string,
 *  timestamp: number // Code
 * }>}
 */
function getBearerKey() {
  return new Promise((resolve, reject) => {
    if (bearerKeyCache == null || bearerKeyCache.timestamp < Date.now() + 5000)
      axios
        .post(
          `https://id.twitch.tv/oauth2/token?client_id=${twitchcreds.id}&client_secret=${twitchcreds.secret}&grant_type=client_credentials`
        )
        .then((creds) =>
          resolve(
            (bearerKeyCache = {
              access_token: creds.data.access_token,
              timestamp: creds.data.expires_in * 1000 + Date.now(),
            })
          )
        )
        .catch((err) => {
          console.error(err);
          reject(err);
        });
    else resolve(bearerKeyCache);
  });
}

app.get("/api/twitch/getname", (req, res) => {
  if (typeof req.query.id !== "undefined")
    getBearerKey()
      .then((creds) => {
        axios
          .get(`https://api.twitch.tv/helix/users?id=${req.query.id}`, {
            headers: {
              Authorization: `Bearer ${creds.access_token}`,
              "Client-Id": twitchcreds.id,
            },
          })
          .then((result) => {
            res.send(result.data.data[0].display_name);
          });
      })
      .catch((err) => {
        error(res, 500, "Internal Twitch Error.");
      });
  else error(res, 400);
});
//#endregion
//#region twitter
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
app.get("/redirect/twitter/login", twitter("authenticate", loginOauth));
app.get("/redirect/twitter/add", twitter("authorize", addOauth));

/**
 *
 * @param {"authenticate" | "authorize"} method - Twitter authentication method
 * @param {oauth.OAuth} oauth - oauth.Oauth instance to use
 * @returns {(req: Request, res: Response)=>void}
 */
function twitter(method, oauth) {
  return async (req, res) => {
    getOAuthRequestToken(oauth)
      .then((result) => {
        const { oauthRequestToken, oauthRequestTokenSecret } = result;
        req.session.twitterOauthRequestToken = oauthRequestToken;
        req.session.twitterOauthRequestTokenSecret = oauthRequestTokenSecret;

        res.redirect(
          `https://api.twitter.com/oauth/${method}?oauth_token=${oauthRequestToken}`
        );
      })
      .catch((err) => {
        error(res, 500, "Twitter Error.");
      });
  };
}

/**
 *
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
 * @returns {Promise<{oauthAccessToken: string, oauthAccessTokenSecret: string, results: {id: number, id_str: string,name: string, screen_name: string, location: string|null, url: string|null, description: string|null, protected: boolean, verified: boolean, followers_count: number, friends_count: number, listed_count: number, favourites_count: number, statuses_count: number, created_at: string, profile_banner_url: string, profile_image_url_https: string, default_profile: boolean, default_profile_image: boolean, withheld_in_countries: Array<string>, withheld_scope: "user"|undefined}}>}
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
 * @returns {Promise<{id: number, id_str: string,name: string, screen_name: string, location: string|null, url: string|null, description: string|null, protected: boolean, verified: boolean, followers_count: number, friends_count: number, listed_count: number, favourites_count: number, statuses_count: number, created_at: string, profile_banner_url: string, profile_image_url_https: string, default_profile: boolean, default_profile_image: boolean, withheld_in_countries: Array<string>, withheld_scope: "user"|undefined}>}
 */
function twitterCallback(req, res, oauth) {
  return new Promise((resolve, reject) => {
    const { twitterOauthRequestToken, twitterOauthRequestTokenSecret } =
      req.session;
    const { oauth_verifier } = req.query;
    getOAuthAccessTokenWith(
      twitterOauthRequestToken,
      twitterOauthRequestTokenSecret,
      oauth_verifier,
      oauth
    )
      .then((result) => {
        const { results } = result;
        resolve(results);
      })
      .catch((err) => {
        console.error(err);
        error(res);
      });
  });
}
app.get("/auth/twitter/login", async (req, res) => {
  twitterCallback(req, res, loginOauth).then((user) => {
    delete req.session.twitterOauthRequestToken;
    delete req.session.twitterOauthRequestTokenSecret;
    database
      .createAccountWith("twitter_id", user.user_id)
      .then(() => res.redirect("/twitter/" + user.screen_name));
  });
});
app.get("/auth/twitter/add", async (req, res) => {
  if (typeof req.session.userid !== "undefined")
    twitterCallback(req, res, addOauth).then((user) => {
      delete req.session.twitterOauthRequestToken;
      delete req.session.twitterOauthRequestTokenSecret;
      database
        .addToAccount("twitter_id", req.session.userid, user.user_id)
        .then((result) => {
          res.redirect("/twitter/" + user.screen_name);
        });
    });
});

app.get("/api/twitter/getname", (req, res) => {
  if (!isNaN(req.query.id)) {
    axios
      .get(
        `https://api.twitter.com/1.1/users/show.json?user_id=${req.query.id}&include_entities=false`,
        {
          headers: {
            authorization: `Bearer ${twittercreds.bearertoken}`,
          },
        }
      )
      .then((data) => {
        res.send(data.data);
      })
      .catch(() => {
        error(res, 500, "Twitter Error.");
      });
  } else error(res, 400, "Invalid Params.");
});

//#endregion
//#region steam
let authlogin = new SteamAuth(url + "auth/steam/login", url);
let authadd = new SteamAuth(url + "auth/steam/add", url);
app.get("/redirect/steam/login", (req, res) => {
  authlogin
    .getAuthUrl()
    .then((url) => res.redirect(url))
    .catch(() => error(res, 500, "Steam Error."));
});
app.get("/redirect/steam/add", (req, res) => {
  authadd
    .getAuthUrl()
    .then((url) => res.redirect(url))
    .catch(() => error(res, 500, "Steam Error."));
});
app.get("/auth/steam/login", (req, res) => {
  authlogin
    .verify(req)
    .then((steamId) => {
      database
        .createAccountWith("steam_id", steamId)
        .then((userid) => {
          req.session.userid = userid;
          console.log(userid + " logged in!");
          res.redirect("/id/" + userid);
        })
        .catch((err) => {
          console.error(err.toString());
          error(res, 500, "Database Errror.");
        });
    })
    .catch((err) => {
      console.error(err);
      error(res, 400, "Steam Authentication Error.");
    });
});
app.get("/auth/steam/add", (req, res) => {
  if (typeof req.session.userid !== "undefined")
    authadd
      .verify(req)
      .then((steamId) => {
        database
          .addToAccount("steam_id", req.session.userid, steamId)
          .then((id) => {
            res.redirect("/id/" + req.session.userid);
          });
      })
      .catch((err) => {
        error(res, 400, "Steam Authentication Error.");
      });
});
app.get("/api/steam/getname", (req, res) => {
  if (!isNaN(req.query.id))
    axios
      .get(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamcreds.key}&steamids=${req.query.id}`
      )
      .then((result) => res.send(result.data.response.players[0]))
      .catch((err) => console.error(err));
});
//#endregion
//#region youtube
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
app.get("/redirect/youtube/login", (req, res) => {
  youtubeLogin
    .getAuthUrl("select_account", req.session)
    .then((url) => res.redirect(url))
    .catch(console.error);
});
app.get("/redirect/youtube/add", (req, res) => {
  if (typeof req.session.userid === "undefined")
    return error(res, 401, "Log In First!");
  youtubeAdd
    .getAuthUrl("select_account", req.session)
    .then((url) => {
      res.redirect(url);
    })
    .catch(console.error);
});
app.get("/auth/youtube/login", (req, res) => {
  youtubeLogin
    .verify(req.query, req.session, ["id"])
    .then((data) =>
      database
        .createAccountWith("youtube_id", data.id)
        .then((userid) => {
          req.session.userid = userid;
          res.redirect("/youtube/" + data.id);
        })
        .catch(() => error(res, 500, "Database Error"))
    )
    .catch((err) => {
      console.error(err);
      error(res, 500, "YouTube Error");
    });
});
app.get("/auth/youtube/add", (req, res) => {
  if (typeof req.session.userid === "undefined")
    return error(res, 401, "Log In First!");
  youtubeAdd
    .verify(req.query, req.session, ["id"])
    .then((data) =>
      database
        .addToAccount("youtube_id", req.session.userid, data.id)
        .then(() => res.redirect("/youtube/" + data.id))
        .catch((err) => {
          console.error(err);
          error(res, 500, "Database Error");
        })
    )
    .catch((err) => {
      console.error(err);
      error(res, 500, "YouTube Error");
    });
});

app.get("/api/youtube/getname", (req, res) => {
  if (typeof req.query.id !== "undefined")
    axios
      .get(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${req.query.id}&key=${googlecreds.api_key}`
      )
      .then((result) => res.send(result.data.items[0]))
      .catch((err) => console.error(err));
});
//#endregion
//#region embed
/**
 *
 * @param {string} from
 * @param {string} name
 * @returns {Promise<{dbdata: Object.<string, number>, userdata: Object.<string, {name: string, html_url: string, picture: string}>}>}
 */
function getData(from, name) {
  return new Promise((resolve, reject) => {
    switch (from) {
      case "github":
        axios
          .get("https://api.github.com/users/" + name, {
            auth: ghcreds.tokenauth,
          })
          .then((userdata) => {
            userdata.data.name = userdata.data.name;
            userdata.data.html_url = userdata.data.html_url;
            userdata.data.picture = userdata.data.avatar_url;
            database
              .getUser("github_id", userdata.data.id)
              .then((result) =>
                resolve({
                  dbdata: result,
                  userdata: {
                    GITHUB_ID: userdata.data,
                  },
                })
              )
              .catch((e) => reject("Uh Oh!"));
          })
          .catch((err) => {
            console.error(err);
            reject("GitHub Error.");
          });
        break;
      case "ghid":
        if (isNaN(name)) reject("Invalid ID.");
        else
          database
            .getUser("GITHUB_ID", name)
            .then((user) => {
              if (typeof user === "undefined")
                reject("This person doesn't have a movr account!");
              else
                resolve({
                  dbdata: user,
                });
            })
            .catch((e) => reject("Database Error"));
        break;
      case "twitch":
        getBearerKey()
          .then((creds) => {
            axios
              .get(`https://api.twitch.tv/helix/users?login=${name}`, {
                headers: {
                  Authorization: `Bearer ${creds.access_token}`,
                  "Client-Id": twitchcreds.id,
                },
              })
              .then((result) => {
                result.data.data[0].name = result.data.data[0].display_name;
                result.data.data[0].html_url =
                  "https://twitch.tv/" + result.data.data[0].login;
                result.data.data[0].picture =
                  result.data.data[0].profile_image_url;
                database
                  .getUser("TWITCH_ID", result.data.data[0].id)
                  .then((user) => {
                    if (typeof user === "undefined")
                      reject("This person doesn't have a movr account!");
                    else
                      resolve({
                        dbdata: user,
                        userdata: {
                          TWITCH_ID: result.data.data[0],
                        },
                      });
                  })
                  .catch((err) => {
                    console.error(err);
                    error("Database Error.");
                  });
              })
              .catch((err) => reject(err));
          })
          .catch((err) => console.error(err));

        break;
      case "twitter":
        axios
          .get(
            `https://api.twitter.com/1.1/users/show.json?screen_name=${name}&include_entities=false`,
            {
              headers: {
                authorization: `Bearer ${twittercreds.bearertoken}`,
              },
            }
          )
          .then((data) => {
            data.data.html_url = "https://twitter.com/" + data.data.screen_name;
            data.data.picture = data.data.profile_image_url_https.replace(
              "_normal",
              ""
            );
            data.data.entities = {};
            database
              .getUser("TWITTER_ID", data.data.id_str)
              .then((result) =>
                resolve({
                  dbdata: result,
                  userdata: {
                    TWITTER_ID: data.data,
                  },
                })
              )
              .catch((e) => reject("Uh Oh!"));
          })
          .catch((err) => {
            console.error(err);
            reject("Twitter Error.");
          });
        break;
      case "steam":
        axios
          .get(
            `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${steamcreds.key}&vanityurl=${name}&url_type=1`
          )
          .then((data) => {
            if (data.data.response.success === 1) {
              axios
                .get(
                  `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamcreds.key}&steamids=${data.data.response.steamid}`
                )
                .then((result) => {
                  database
                    .getUser(
                      "STEAM_ID",
                      result.data.response.players[0].steamid
                    )
                    .then((user) => {
                      if (typeof user === "undefined")
                        reject("This person doesn't have a movr account!");
                      else {
                        result.data.response.players[0].name =
                          result.data.response.players[0].personaname;
                        result.data.response.players[0].html_url =
                          result.data.response.players[0].profileurl;
                        result.data.response.players[0].picture =
                          result.data.response.players[0].avatarfull;
                        resolve({
                          dbdata: user,
                          userdata: {
                            STEAM_ID: result.data.response.players[0],
                          },
                        });
                      }
                    })
                    .catch((err) => {
                      console.error(err);
                      error("Database Error.");
                    });
                })
                .catch((err) => reject("Steam Errror."));
            } else if (data.data.response.success === 42)
              reject("This account doesn't exist.");
            else reject("Steam Error.");
          });
        break;
      case "youtube":
        axios
          .get(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet&part=id&id=${name}&key=${googlecreds.api_key}`,
            {
              headers: {
                Accept: "application/json",
              },
            }
          )
          .then((result) => {
            if (result.data.pageInfo.totalResults < 1)
              return reject("This account doesn't exist.");
            database
              .getUser("YOUTUBE_ID", name)
              .then((user) => {
                if (typeof user === "undefined")
                  return reject("This user doesn't have MOVR.");
                let finalObject = result.data.items[0];
                finalObject.name = finalObject.snippet.title;
                finalObject.html_url =
                  "https://youtube.com/channel/" + finalObject.id;
                finalObject.picture = finalObject.snippet.thumbnails.high.url;
                resolve({
                  dbdata: user,
                  userdata: {
                    YOUTUBE_ID: finalObject,
                  },
                });
              })
              .catch((err) => reject("Database Error."));
          })
          .catch((err) => {
            reject("YouTube Error.");
          });
        break;
      case "id":
        if (isNaN(name)) reject("Invalid ID.");
        else
          database
            .getUser("ID", name)
            .then((user) => {
              if (typeof user === "undefined")
                reject("This person doesn't have a movr account!");
              else
                resolve({
                  dbdata: user,
                });
            })
            .catch((e) => reject("Database Error"));
        break;
      default:
        reject("Method Not Found");
        break;
    }
  });
}

let sortStyle = [
  "GITHUB_ID",
  "TWITTER_ID",
  "DISCORD_ID",
  "TWITCH_ID",
  "STEAM_ID",
  "YOUTUBE_ID",
];

/**
 *
 * @param {Object.<string, number>} dbdata
 * @param {Object.<string, {name: string, html_url: string, picture: string}>} userdata
 * @returns {Object.<string, {name: string, html_url: string, picture: string}>}
 */
function getProfile(dbdata, userdata) {
  return new Promise((resolve, reject) => {
    if (typeof userdata !== "undefined") resolve(userdata);
    else
      for (let sort of sortStyle) {
        let id = dbdata[sort];
        if (id != null) {
          switch (sort) {
            case "GITHUB_ID":
              axios
                .get("https://api.github.com/user/" + id, {
                  auth: ghcreds.tokenauth,
                })
                .then((result) => {
                  let finalObject = {};
                  finalObject[sort] = {
                    name: result.data.name,
                    html_url: result.data.html_url,
                    picture: result.data.avatar_url,
                  };
                  resolve(finalObject);
                })
                .catch((err) => {
                  let finalObject = {};
                  finalObject[sort] = {
                    name: "try again later",
                    picture: url + "favicon.png",
                  };
                  resolve(finalObject);
                });
              break;
            case "TWITTER_ID":
              axios
                .get(
                  `https://api.twitter.com/1.1/users/show.json?user_id=${id}&include_entities=false`,
                  {
                    headers: {
                      authorization: `Bearer ${twittercreds.bearertoken}`,
                    },
                  }
                )
                .then((result) => {
                  let finalObject = {};
                  finalObject[sort] = {
                    name: result.data.name,
                    html_url: "https://twitter.com/" + result.data.screen_name,
                    picture: result.data.profile_image_url_https,
                  };
                  resolve(finalObject);
                });
              break;
            case "DISCORD_ID":
              axios
                .get(`https://discord.com/api/v8/users/${id}`, {
                  headers: {
                    Authorization: `Bot ${discordcreds.bot}`,
                  },
                })
                .then((result) => {
                  let finalObject = {};
                  finalObject[sort] = {
                    name:
                      result.data.username + "#" + result.data.discriminator,
                    picture: `https://cdn.discordapp.com/avatars/${result.data.id}/${result.data.avatar}.png`,
                  };
                  resolve(finalObject);
                });
              break;
            case "TWITCH_ID":
              getBearerKey().then((creds) =>
                axios
                  .get(`https://api.twitch.tv/helix/users?id=${id}`, {
                    headers: {
                      Authorization: `Bearer ${creds.access_token}`,
                      "Client-Id": twitchcreds.id,
                    },
                  })
                  .then((result) => {
                    let finalObject = {};
                    finalObject[sort] = {
                      name: result.data.display_name,
                      html_url: "https://twitch.tv/" + result.data.login,
                      picture: result.data.profile_image_url,
                    };
                    resolve(finalObject);
                  })
              );
              break;
            case "STEAM_ID":
              axios
                .get(
                  `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamcreds.key}&steamids=${id}`
                )
                .then((result) => {
                  let finalObject = {};
                  finalObject[sort] = {
                    name: result.data.response.players[0].personaname,
                    html_url: result.data.response.players[0].profileurl,
                    picture: result.data.response.players[0].avatarfull,
                  };
                  resolve(finalObject);
                })
                .catch((err) => reject("Steam Errror."));
              break;
            case "YOUTUBE_ID":
              axios
                .get(
                  `https://www.googleapis.com/youtube/v3/channels?part=snippet&part=id&id=${id}&key=${googlecreds.api_key}`,
                  {
                    headers: {
                      Accept: "application/json",
                    },
                  }
                )
                .then((result) => {
                  if (result.data.pageInfo.totalResults < 1)
                    return reject("This account doesn't exist.");
                  let finalObject = {};
                  finalObject[sort] = {
                    name: result.data.items[0].snippet.title,
                    html_url:
                      "https://youtube.com/channel/" + result.data.items[0].id,
                    picture: result.data.items[0].snippet.thumbnails.high.url,
                  };
                  resolve(finalObject);
                })
                .catch((err) => {
                  console.error(err);
                  reject("YouTube Error.");
                });
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
app.get("/:from/:name", (req, res) => {
  const from = req.params.from;
  const name = req.params.name;
  getData(from, name)
    .then((data) => {
      if (typeof data.dbdata === "undefined")
        error(res, 404, "This account type isn't supported.");
      else
        getProfile(data.dbdata, data.userdata).then((result) => {
          res.render("person.ejs", {
            from: req.params.from,
            name: req.params.name,
            sessionuserid: req.session.userid,
            discordid: discordcreds.id,
            ghid: ghcreds.id,
            twitchid: twitchcreds.id,
            ids: data.dbdata || {},
            precachedaccount: result,
            url,
          });
        });
    })
    .catch((err) => {
      if (typeof err === "string") error(res, 500, err);
    });
});
app.get("*");

app.listen(port, () => console.log(`Movr listening on port ${port}!`));
