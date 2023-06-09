"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zen2han = void 0;
const zen2han = (str) => {
    return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
        return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
    });
};
exports.zen2han = zen2han;
