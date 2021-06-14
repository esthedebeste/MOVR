import {
    readFileSync
} from "fs";
export default file => JSON.parse(readFileSync(new URL(file,
    import.meta.url)));