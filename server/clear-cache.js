"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const models_1 = require("./src/models");
dotenv_1.default.config();
const clear = async () => {
    if (process.env.MONGODB_URI) {
        await mongoose_1.default.connect(process.env.MONGODB_URI);
        await models_1.CitySpot.deleteMany({});
        console.log('Cleared CitySpot cache in Atlas.');
        process.exit(0);
    }
    else {
        console.log('No MONGODB_URI, memory cache is transient anyway. Restart the server to clear it.');
        process.exit(0);
    }
};
clear();
