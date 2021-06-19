import { readFileSync } from "fs";
/**
 *
 * @param {string} file
 * @returns {object}
 */
const parse = file => JSON.parse(readFileSync(new URL(file, import.meta.url)));
export default parse;
