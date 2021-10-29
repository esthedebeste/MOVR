import { openSync } from "ibm_db";
import sqlstring from "sqlstring";

/**
 * !! Uses "ID" as an internal MOVR id! !!
 */
export default class Db2 {
	/**
	 * @param {string} tablename - What's the table called?
	 * @param {object} creds     - Credentials
	 */
	constructor(tablename, creds) {
		this.table = tablename;
		if (!creds && process.env.VCAP_SERVICES) {
			let env = JSON.parse(process.env.VCAP_SERVICES);
			if (env.dashDB) creds = env.dashDB[0].credentials;
			else if (env["dashDB For Transactions"])
				creds = env["dashDB For Transactions"][0].credentials;
			else
				throw new Error(
					"Couldn't find db2 credentials in process.env.VCAP_SERVICES"
				);
		} else
			throw new Error(
				"Couldn't find db2 credentials (maybe you haven't specified fromfile?)"
			);
		let connString = `DRIVER={DB2};DATABASE=${creds.db};HOSTNAME=${
			creds.hostname
		};UID=${creds.username};PWD=${creds.password};PORT=${
			creds.port + 1
		};PROTOCOL=TCPIP;Security=SSL;`;
		console.log(`Connecting to database with hostname ${creds.hostname}...`);
		this.db = openSync(connString);
		console.log("Connected!");
		process.on("exit", function () {
			this.db.closeSync();
		});
	}

	/**
	 * Creates a new MOVR account
	 * @param {string} type - With what 3rd party provider we should create the account (Ends with "_ID")
	 * @param {number} id - The id that the 3rd party provider has assigned to this user
	 * @returns {Promise<number>} The new user's internal MOVR id
	 */

	async createAccountWith(type, id) {
		id = sqlstring.escape(id, true);
		// Existing check
		const idcheck = await this.db.query(
			`select id from ${this.table} where ${type}=${id} limit 1`
		);
		const exists = idcheck.length > 0;
		if (exists) return idcheck[0].ID;
		// Create account
		await this.db.query(`insert into ${this.table} (${type}) values (${id})`);
		// Get account id of created account
		const [user] = await this.db.query(
			`select id from ${this.table} where ${type}=${id} limit 1`
		);
		return user.ID;
	}

	/**
	 * Adds a 3rd party id to this account
	 * @param {string} type - The 3rd party provider's name (Ends with "_ID")
	 * @param {number} movrid - The user's internal MOVR id
	 * @param {number} id - The id that the 3rd party provider has assigned to this user
	 * @returns {Promise<void>} Nothing.
	 */
	async addToAccount(type, movrid, id) {
		id = sqlstring.escape(id, true);

		await this.db.query(`delete from ${this.table} where ${type}=${id}`);
		await this.db.query(
			`update ${this.table} set ${type}=${id} where id=${movrid} limit 1`
		);
	}

	/**
	 * Gets all of a user's account ID's.
	 * @param {string} type - Key to get it by (Ends with "_ID") (put "ID" to use MOVR's internal id)
	 * @param {number} id - id to get it by
	 * @returns {Promise<Record<string, number | null>>} The IDs
	 */
	async getUser(type, id) {
		id = sqlstring.escape(id, true);
		const [user] = await this.db.query(
			`select * from ${this.table} where ${type}=${id} limit 1`
		);
		return user;
	}

	/**
	 *
	 * @param {string} gettype - Key to get it by (Ends with "_ID") (put "ID" to use MOVR's internal id)
	 * @param {number} getvalue - id to get it by
	 * @param {string} returntype - The key to return
	 * @returns {Promise<number | null>} The id of that 3rd party provider, or null if undefined
	 */
	async getAccount(gettype, getvalue, returntype) {
		getvalue = sqlstring.escape(getvalue, true);
		returntype = returntype.toUpperCase();
		const [user] = await this.db.query(
			`select ${returntype} from ${this.table} where ${gettype}=${getvalue} limit 1`
		);
		return user[returntype];
	}

	/**
	 * Deletes a user by their MOVR id.
	 * @param {number} id
	 * @returns {Promise<number>} the deleted user's MOVR id
	 */
	async deleteUser(id) {
		const uid = sqlstring.escape(id, true);
		await this.db.query(`delete from ${this.table} where id=${uid} limit 1`);
		return id;
	}
}
