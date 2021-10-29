import { blueprint } from "coggers";
import { redirect as discord } from "../accounts/discord.js";
import { redirect as github } from "../accounts/github.js";
import { redirect as steam } from "../accounts/steam.js";
import { redirect as twitch } from "../accounts/twitch.js";
import { redirect as twitter } from "../accounts/twitter.js";
import { redirect as youtube } from "../accounts/youtube.js";

export const redirect = blueprint({
	steam,
	twitch,
	youtube,
	twitter,
	github,
	discord,
});
