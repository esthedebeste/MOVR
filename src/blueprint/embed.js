import { blueprint } from "coggers";
import * as github from "../accounts/github.js";
import * as steam from "../accounts/steam.js";
import * as twitch from "../accounts/twitch.js";
import * as twitter from "../accounts/twitter.js";
import * as youtube from "../accounts/youtube.js";
import { database, url } from "../utils.js";

export const $$from = blueprint({
	$$name: {
		async $get(req, res, { from, name }) {
			if (!(from in embeds))
				return res.error(404, "This account type isn't supported.");
			const embed = await embeds[from](name);
			if (typeof embed === "string") return res.error(500, embed);
			const { dbdata, userdata } = embed;
			res.render("person", {
				from,
				name,
				sessionuserid: req.session.userid,
				ids: dbdata,
				precachedaccount: userdata,
				cached: Object.values(userdata)[0],
				url,
			});
		},
	},
});
const embeds = {
	github: github.embed,
	ghid: github.embedId,
	twitch: twitch.embed,
	twitter: twitter.embed,
	steam: steam.embed,
	youtube: youtube.embed,
	id: async name => {
		if (isNaN(name)) return "Invalid ID.";
		else {
			try {
				const user = await database.getUser("ID", name);
				if (user == null) return "This person doesn't have a movr account!";
				else
					return {
						dbdata: user,
						userdata: {},
					};
			} catch (err) {
				console.error(err);
				return "Database Error";
			}
		}
	},
};
