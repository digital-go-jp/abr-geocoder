import {test, expect, describe} from '@jest/globals';
import { kan2num } from '../kan2num';


describe('kan2num', () =>{

    test('test1', () => {
        const result = kan2num('ソルティア岡本一');
        expect(result).toBe('ソルティア岡本1');
    });
    
    test('test3', () => {
        const result = kan2num('ソルティア岡本四十四');
        expect(result).toBe('ソルティア岡本44');
    });
    
});
