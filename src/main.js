import { logger } from "@tinyhttp/logger";
import Coggers, { express, renderEngine } from "coggers";
import ejs from "ejs";
import { ironSession } from "next-iron-session";
import sirv from "sirv";
import sessionpasswords from "../config/sessionpasswords.json";
import { root } from "./blueprint/root.js";
import { devenv } from "./utils.js";
const coggers = new Coggers(
	{
		$: [
			express(
				sirv("public", {
					etag: true,
					dev: devenv,
				}),
				ironSession({
					cookieName: "movr-sid",
					password: sessionpasswords,
					cookieOptions: {
						httpOnly: true,
						sameSite: "lax",
						secure: !devenv,
					},
				}),
				logger({
					emoji: devenv,
					methods: ["GET", "POST"],
					output: {
						callback: console.log,
						color: devenv,
					},
				})
			),
			renderEngine(ejs.renderFile, new URL("../views", import.meta.url), "ejs"),
			// Middleware that makes ironSession behave similarly to express-session
			(req, res) => {
				let modified = false;
				const orig = req.session;
				req.session = new Proxy(req.session, {
					get(target, prop) {
						if (prop === "destroySession") return orig.destroy.bind(orig);
						return target.get(prop);
					},
					set(target, prop, value) {
						target.set(prop, value);
						return (modified = true);
					},
					deleteProperty(target, prop) {
						target.unset(prop);
						return (modified = true);
					},
					has(target, prop) {
						return target.get(prop) !== undefined;
					},
				});
				const _end = res.end.bind(res);
				res.end = (...args) => {
					if (modified)
						orig
							.save()
							.catch(console.error)
							.finally(() => _end(...args));
					else _end(...args);
				};
			},
			(req, res) => {
				res.error = (code = 500, errtext = "Internal Error.") =>
					res.status(code).render("error", {
						error: errtext,
					});
			},
		],
		...root,
	},
	{
		xPoweredBy: "COGGERS :D",
		notFound(req, res) {
			res.error(404, "Page Not Found!");
		},
	}
);
const server = await coggers.listen(process.env.PORT || 80);
const { port } = server.address();
console.info(`Listening on http://localhost:${port}/`);
