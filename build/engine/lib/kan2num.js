"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kan2num = void 0;
const japanese_numeral_1 = require("@geolonia/japanese-numeral");
const kan2num = (string) => {
    const kanjiNumbers = (0, japanese_numeral_1.findKanjiNumbers)(string);
    for (let i = 0; i < kanjiNumbers.length; i++) {
        string = string.replace(kanjiNumbers[i], (0, japanese_numeral_1.kanji2number)(kanjiNumbers[i]).toString());
    }
    return string;
};
exports.kan2num = kan2num;
