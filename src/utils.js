import movrconfig from "../config/movrconfig.json";
import Database from "./database/db2.js";
import TestingDB from "./database/testingdb.js";
export const devenv = process.argv.includes("--dev");
// Format to a valid URL which ends with a /
export const url = new URL(
	devenv ? "http://localhost/" : movrconfig.url
).toString();

export const database = devenv
	? new TestingDB()
	: new Database(
			(await import("../config/db2config.json")).tablename,
			await import("../config/db2creds.json")
	  );
