import { jest } from "@jest/globals";

export const setImmediateSpy = () => {
  return jest.spyOn(global, 'setImmediate').mockImplementation((callback) => {
    callback();
    return {} as NodeJS.Immediate;
  });
};
