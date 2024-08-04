import {expect, test, describe} from '@jest/globals';
import { kan2num } from '../kan2num';

describe("kan2num", () => {
    test("test1", () => {
        const result = kan2num("ソルティア岡本一丁目")
        expect(result).toBe("ソルティア岡本1丁目");
    });
});
