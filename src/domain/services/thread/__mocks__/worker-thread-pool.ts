import { jest } from '@jest/globals';
import EventEmitter from 'events';

const originalModule = jest.requireActual('@domain/services/thread/worker-thread-pool');

class MockWorkerThreadPool extends EventEmitter {
  run = jest.fn().mockReturnValue(Promise.resolve({
    dummy: 'dummy',
  }));

  close = jest.fn();
}
const WorkerThreadPool = {
  create: jest.fn().mockImplementation(() => {
    return Promise.resolve(new MockWorkerThreadPool());
  }),
}

module.exports = {
  ...Object.assign({}, originalModule),
  WorkerThreadPool,
}
