import {
    openSync
} from "ibm_db";
import sqlstring from "sqlstring";
import json from "./jsonimport.js";

/**
 * !! Uses "ID" as an internal MOVR id! !!
 */
export default class Db2 {
    /**
     * @param {string}             tablename - What's the table called? 
     * @param {boolean | undefined} fromfile - Should we use config/db2creds.json as credentials?  
     */
    constructor(tablename, fromfile = false) {
        this.table = tablename;
        let creds;
        if (fromfile)
            creds = json("config/db2creds.json");
        else if (process.env.VCAP_SERVICES) {
            let env = JSON.parse(process.env.VCAP_SERVICES);
            if (env.dashDB)
                creds = env.dashDB[0].credentials;
            else if (env["dashDB For Transactions"])
                creds = env["dashDB For Transactions"][0].credentials;
            else
                throw new Error("Couldn't find db2 credentials in process.env.VCAP_SERVICES");
        } else
            throw new Error("Couldn't find db2 credentials (maybe you haven't specified fromfile?)");
        let connString = `DRIVER={DB2};DATABASE=${creds.db};HOSTNAME=${creds.hostname};UID=${creds.username};PWD=${creds.password};PORT=${creds.port+1};PROTOCOL=TCPIP;Security=SSL;`;
        console.log(`Connecting to database with hostname ${creds.hostname}...`);
        this.db = openSync(connString);
        console.log("Connected!");
    }

    /**
     * Creates a new MOVR account
     * @param {string} type - With what 3rd party provider we should create the account (Ends with "_ID")
     * @param {number} id - The id that the 3rd party provider has assigned to this user
     * @returns {number} The new user's internal MOVR id
     */

    createAccountWith(type, id) {
        id = sqlstring.escape(id, true);
        return new Promise((resolve, reject) => {
            // Existing check
            this.db.query(`select id from ${this.table} where ${type}=${id} limit 1`).then(result => {
                if (result.length > 0)
                    return resolve(result[0].ID);
                // Create account
                this.db.query(`insert into ${this.table} (${type}) values (${id})`).then(result => {
                    // Get account id
                    this.db.query(`select id from ${this.table} where ${type}=${id} limit 1`).then(id => {
                        resolve(id[0].ID);
                    }).catch(e => reject(e));
                }).catch(e => reject(e));
            }).catch(err => reject(err));
        });
    }

    /**
     * Adds a 3rd party id to this account
     * @param {string} type - The 3rd party provider's name (Ends with "_ID") 
     * @param {number} movrid - The user's internal MOVR id
     * @param {number} id - The id that the 3rd party provider has assigned to this user
     * @returns {void} Nothing.
     */
    addToAccount(type, movrid, id) {
        id = sqlstring.escape(id, true);
        return new Promise((resolve, reject) => {
            this.db.query(`delete from ${this.table} where ${type}=${id}`).then(() => {
                this.db.query(`update ${this.table} set ${type}=${id} where id=${movrid} limit 1`).then(result => {
                    resolve();
                }).catch(e => reject(e));
            }).catch(e => reject(e));
        });
    }

    /**
     * Gets all of a user's account ID's.
     * @param {string} type - Key to get it by (Ends with "_ID") (put "ID" to use MOVR's internal id) 
     * @param {number} id - id to get it by
     * @returns {Object.<string, number | null>} The IDs
     */
    getUser(type, id) {
        id = sqlstring.escape(id, true);
        return new Promise((resolve, reject) => {
            this.db.query(`select * from ${this.table} where ${type}=${id} limit 1`).then(result => {
                resolve(result[0]);
            }).catch(e => reject(e));
        });
    }

    /**
     * 
     * @param {string} gettype - Key to get it by (Ends with "_ID") (put "ID" to use MOVR's internal id) 
     * @param {number} getvalue - id to get it by
     * @param {string} returntype - The key to return
     * @returns {number | null} The id of that 3rd party provider, or null if undefined
     */
    getAccount(gettype, getvalue, returntype) {
        getvalue = sqlstring.escape(getvalue, true);
        returntype = returntype.toUpperCase();
        return new Promise((resolve, reject) => {
            this.db.query(`select ${returntype} from ${this.table} where ${gettype}=${getvalue} limit 1`).then(result => {
                resolve(result[0][returntype]);
            }).catch(e => reject(e));
        });
    }
}