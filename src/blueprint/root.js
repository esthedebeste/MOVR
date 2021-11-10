import { blueprint } from "coggers";
import discordcreds from "../../config/discordcreds.json";
import ghcreds from "../../config/ghclientcreds.json";
import twitchcreds from "../../config/twitchcreds.json";
import { url } from "../utils.js";
import { api } from "./api.js";
import { auth } from "./auth.js";
import { $$from } from "./embed.js";
import { redirect } from "./redirect.js";
export const root = blueprint({
	$get(req, res) {
		res.render("index", {
			ghid: ghcreds.id,
			discordid: discordcreds.id,
			twitchid: twitchcreds.id,
			url,
		});
	},
	myid: {
		$get(req, res) {
			res.send(req.session.userid);
		},
	},
	auth,
	redirect,
	api,
	$$from,
});
