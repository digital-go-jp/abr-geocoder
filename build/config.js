"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDataDir = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
async function getDataDir(overrideDataDir) {
    let dataDir;
    if (overrideDataDir) {
        dataDir = overrideDataDir;
    }
    else {
        dataDir = node_path_1.default.join(node_os_1.default.homedir(), '.abr-geocoder');
    }
    await node_fs_1.default.promises.mkdir(dataDir, { recursive: true });
    return dataDir;
}
exports.getDataDir = getDataDir;
