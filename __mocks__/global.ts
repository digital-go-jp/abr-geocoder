import { jest } from "@jest/globals";

export const setImmediateSpy = jest.spyOn(global, 'setImmediate')
  .mockImplementation((callback) => {
    callback(); // すぐにコールバックを実行するようにする
    return {} as NodeJS.Immediate;
  });
