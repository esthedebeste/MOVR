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
    {
      ID: null,
      YOUTUBE_ID: null,
      TWITCH_ID: null,
      TWITTER_ID: null,
      GITHUB_ID: null,
      STEAM_ID: null,
      DISCORD_ID: null,
    },
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
  constructor() {
    this.users = [];
  }

  /**
   * Creates a new MOVR account
   * @param {string} type - With what 3rd party provider we should create the account (Ends with "_ID")
   * @param {number} id - The id that the 3rd party provider has assigned to this user
   * @returns {number} The new user's internal MOVR id
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
   * @returns {void} Nothing.
   */
  async addToAccount(type, movrid, id) {
    this.users = this.users.filter(value => value[type.toUpperCase()] == id);
    this.users[movrid][type.toUpperCase()] = id;
  }

  /**
   * Gets all of a user's account ID's.
   * @param {string} type - Key to get it by (Ends with "_ID") (put "ID" to use MOVR's internal id)
   * @param {number} id - id to get it by
   * @returns {Object.<string, number | null>} The IDs
   */
  async getUser(type, id) {
    const user = this.users.filter(value => value[type.toUpperCase()] == id)[0];
    return user == null ? undefined : user;
  }

  /**
   *
   * @param {string} gettype - Key to get it by (Ends with "_ID") (put "ID" to use MOVR's internal id)
   * @param {number} getvalue - id to get it by
   * @param {string} returntype - The key to return
   * @returns {number | null} The id of that 3rd party provider, or null if undefined
   */
  async getAccount(gettype, getvalue, returntype) {
    const user = await this.getUser(gettype, getvalue);
    return user == null ? undefined : user[returntype.toUpperCase()];
  }
}
