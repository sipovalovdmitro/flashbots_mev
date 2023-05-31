import dbConfig from "../config/db.config.js";
import mongoose from "mongoose";
import pair from "./pair.model.js"
mongoose.Promise = global.Promise;

const db = {};
db.mongoose = mongoose;
db.url = dbConfig.url;
db.pair = pair(mongoose);

export default db;