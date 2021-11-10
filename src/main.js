import Coggers, { express, renderEngine } from "coggers";
import coggersSession from "coggers-session";
import ejs from "ejs";
import { STATUS_CODES } from "node:http";
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
				})
			),
			coggersSession({
				password: sessionpasswords,
				name: "movr-session",
				cookie: {
					httpOnly: true,
					sameSite: "Lax",
					secure: !devenv,
					maxAge: 604800,
					path: "/",
				},
			}),
			renderEngine(ejs.renderFile, new URL("../views", import.meta.url), "ejs"),
			(req, res) => {
				res.error = (code = 500, errtext = "Internal Error.") =>
					res.status(code).render("error", { error: errtext });
			},
			devenv
				? // devenv logger, colors
				  (req, res) => {
						const colors = {
							2: "\x1b[36m",
							3: "\x1b[32m",
							4: "\x1b[31m",
							5: "\x1b[35m",
						};
						res.on("finish", () => {
							const type = res.statusCode.toString()[0];
							const color = colors[type];
							console.log(
								[
									`${req.method}`,
									`\x1b[1m${color}${res.statusCode}`,
									`\x1b[0m${color}` + res.statusMessage ||
										STATUS_CODES[res.statusCode],
									`\x1b[0m${req.url}`,
									type === 3 ? ` => ${res.headers.Location}` : "",
								].join(" ")
							);
						});
				  }
				: // non-devenv logger, no colors
				  (req, res) =>
						res.on("finish", () =>
							console.log(
								req.method + " " + res.statusCode + " " + res.statusMessage ||
									STATUS_CODES[res.statusCode] +
										" " +
										req.url +
										(res.statusCode.toString()[0] === 3
											? ` => ${res.headers.Location}`
											: "")
							)
						),
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
