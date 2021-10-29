const userFormat = {
	ID: null,
	YOUTUBE_ID: null,
	TWITCH_ID: null,
	TWITTER_ID: null,
	GITHUB_ID: null,
	STEAM_ID: null,
	DISCORD_ID: null,
};

const newUser = () =>
	new Proxy(
		{ ...userFormat },
		{
			get(target, prop) {
				return target[prop.toUpperCase()];
			},
			set(target, prop, value) {
				target[prop.toUpperCase()] = value;
				return true;
			},
		}
	);
/**
 * Not persistent.
 */
export default class TestingDB {
	users = [];

	/**
	 * Creates a new MOVR account
	 * @param {string} type - With what 3rd party provider we should create the account (Ends with "_ID")
	 * @param {number} id - The id that the 3rd party provider has assigned to this user
	 * @returns {Promise<number>} The new user's internal MOVR id
	 */

	async createAccountWith(type, id) {
		let account = await this.getAccount(type, id, "ID");
		if (account != null) return account;
		let user = newUser();
		user.ID = this.users.length;
		user[type] = id;
		this.users.push(user);
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
		// this.users = this.users.filter(value => value[type.toUpperCase()] == id);
		this.users[movrid][type.toUpperCase()] = id;
	}

	/**
	 * Gets all of a user's account ID's.
	 * @param {string} type - Key to get it by (Ends with "_ID") (put "ID" to use MOVR's internal id)
	 * @param {number} id - id to get it by
	 * @returns {Promise<Record<string, number | null>>} The IDs
	 */
	async getUser(type, id) {
		const user = this.users.find(value => value[type.toUpperCase()] == id);
		return user == null ? undefined : user;
	}

	/**
	 *
	 * @param {string} gettype - Key to get it by (Ends with "_ID") (put "ID" to use MOVR's internal id)
	 * @param {number} getvalue - id to get it by
	 * @param {string} returntype - The key to return
	 * @returns {Promise<number | null>} The id of that 3rd party provider, or null if undefined
	 */
	async getAccount(gettype, getvalue, returntype) {
		const user = await this.getUser(gettype, getvalue);
		return user == null ? undefined : user[returntype.toUpperCase()];
	}

	/**
	 * Deletes a user by their MOVR id.
	 * @param {number} id
	 * @returns {Promise<number>}
	 */
	async deleteUser(id) {
		delete this.users[id];
		return id;
	}
}
