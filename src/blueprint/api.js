import { blueprint } from "coggers";
import { api as discord } from "../accounts/discord.js";
import { api as steam } from "../accounts/steam.js";
import { api as twitch } from "../accounts/twitch.js";
import { api as twitter } from "../accounts/twitter.js";
import { api as youtube } from "../accounts/youtube.js";
import { database } from "../utils.js";

export const api = blueprint({
	account: {
		":id": {
			async $get(req, res, { id: rawId }) {
				const id = parseInt(rawId);
				if (isNaN(id)) return res.error(400, "Invalid Query.");
				const user = await database.getUser("ID", id);
				res.json(user);
			},
			// Unused, but as there isn't a delete account method yet this'll have to do.
			async $delete(req, res, { id: rawId }) {
				const id = parseInt(rawId);
				const sid = parseInt(req.session.userid);
				if (isNaN(sid) || sid !== id)
					return res.error(403, "This isn't your account");
				await database.deleteUser(sid);
				req.session.destroySession();
				res.type("txt").send(`Deleted user with id ${id}.`);
			},
		},
	},
	twitch,
	discord,
	twitter,
	steam,
	youtube,
});
