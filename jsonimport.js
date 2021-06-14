import {
    readFileSync
} from "fs";
export default file => {
    return JSON.parse(readFileSync(file));
};