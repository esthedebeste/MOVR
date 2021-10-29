import { blueprint } from "coggers";
import { auth as discord } from "../accounts/discord.js";
import { auth as github } from "../accounts/github.js";
import { auth as steam } from "../accounts/steam.js";
import { auth as twitch } from "../accounts/twitch.js";
import { auth as twitter } from "../accounts/twitter.js";
import { auth as youtube } from "../accounts/youtube.js";

export const auth = blueprint({
	discord,
	github,
	steam,
	twitch,
	twitter,
	youtube,
});
