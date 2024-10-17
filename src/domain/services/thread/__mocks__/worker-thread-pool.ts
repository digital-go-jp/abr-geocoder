import { MatchLevel } from '@domain/types/geocode/match-level';
import { jest } from '@jest/globals';
import EventEmitter from 'events';

const originalModule = jest.requireActual('@domain/services/thread/worker-thread-pool');

class MockWorkerThreadPool extends EventEmitter {
  run = jest.fn().mockImplementation((...args: any) => {
    if (args[0].address === '/abr-geocoder/passthrough') {
      return Promise.resolve({
        input: {
          data: args[0],
        },
        match_level: MatchLevel.UNKNOWN.str,
      });
    }

    return Promise.reject('unimplemented yet');
  });

  close = jest.fn();
}
const WorkerThreadPool = {
  create: jest.fn().mockImplementation(() => {
    return Promise.resolve(new MockWorkerThreadPool());
  }),
};

module.exports = {
  ...Object.assign({}, originalModule),
  WorkerThreadPool,
};
