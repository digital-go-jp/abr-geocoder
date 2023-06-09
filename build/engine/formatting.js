"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatResidentialSection = void 0;
function formatResidentialSection(section) {
    return [section.blk, section.addr1, section.addr2].filter(x => !!x).join('-');
}
exports.formatResidentialSection = formatResidentialSection;
