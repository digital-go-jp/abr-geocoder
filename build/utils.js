"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walkDir = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
async function* walkDir(dir) {
    for await (const d of await node_fs_1.default.promises.opendir(dir)) {
        const entry = node_path_1.default.join(dir, d.name);
        if (d.isDirectory())
            yield* walkDir(entry);
        else if (d.isFile())
            yield entry;
    }
}
exports.walkDir = walkDir;
