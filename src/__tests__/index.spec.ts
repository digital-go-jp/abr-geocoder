// reflect-metadata is necessary for DI
import 'reflect-metadata';

import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { onDownload, onGeocoding, onUpdateCheck } from '../controllers';
import { AbrgMessage } from '../domain';
import { main, parseHelper } from '../index';
import { setupContainer } from '../interface-adapter';
import { DEFAULT_FUZZY_CHAR, SINGLE_DASH_ALTERNATIVE } from '../settings/constantValues';


jest.mock('../domain', () => {
  const original: typeof import('../domain') = jest.requireActual('../domain');
  return {
    ...original,
    bubblingFindFile: jest.fn<(current: string, target: string)=>Promise<string | undefined>>().mockResolvedValue('somewhere'),
  }
});

jest.mock('../controllers', () => ({
  onUpdateCheck: jest.fn(),
  onGeocoding: jest.fn(),
  onDownload: jest.fn(),
}));
jest.mock('../interface-adapter', () => ({
  setupContainer: jest.fn(),
}));

describe('parseHelper', () => {
  it.concurrent('should receive [node, abrg]', async () => {
    const processArgv = ['node', 'abrg'];
    const results = parseHelper(processArgv);
    expect(results).toEqual(['node', 'abrg']);
  });
  it.concurrent('should receive [node, abrg, update-check]', async () => {
    const processArgv = ['node', 'abrg', 'update-check'];
    const results = parseHelper(processArgv);
    expect(results).toEqual(['node', 'abrg', 'update-check']);
  });
  it.concurrent('should receive [node, abrg, update-check] even if arguments are not formatted', async () => {
    const processArgv = ['node    abrg    update-check'];
    const results = parseHelper(processArgv);
    expect(results).toEqual(['node', 'abrg', 'update-check']);
  });
  it.concurrent('should receive [node, abrg, update-check, -d, 1234]', async () => {
    const processArgv = ['node', 'abrg', 'update-check', '-d 1234'];
    const results = parseHelper(processArgv);
    expect(results).toEqual(['node', 'abrg', 'update-check', '-d', '1234']);
  });
  it.concurrent('should receive [node, abrg, -d, 1234,  update-check]', async () => {
    const processArgv = ['node', 'abrg', '-d 1234', 'update-check'];
    const results = parseHelper(processArgv);
    expect(results).toEqual(['node', 'abrg', '-d', '1234', 'update-check']);
  });
});

describe('[cli]update-check', () => {

  it.concurrent('should run update-check command', async () => {
    await runCommand('update-check');

    expect(setupContainer).toBeCalledWith({
      dataDir: expect.any(String),
      ckanId: 'ba000001',
    });

    expect(onUpdateCheck).toBeCalledWith({
      container: undefined,
      ckanId: 'ba000001',
    })
  });
  it.concurrent('should receive specified options', async () => {
    await runCommand('update-check', '-r', 'something', '-d', 'somewhere');

    expect(setupContainer).toBeCalledWith({
      dataDir: 'somewhere',
      ckanId: 'something',
    });

    expect(onUpdateCheck).toBeCalledWith({
      container: undefined,
      ckanId: 'something',
    })
  });
  it.concurrent('should receive specified options with long option names', async () => {
    await runCommand('update-check', '--resource', 'something', '--dataDir', 'somewhere');

    expect(setupContainer).toBeCalledWith({
      dataDir: 'somewhere',
      ckanId: 'something',
    });

    expect(onUpdateCheck).toBeCalledWith({
      container: undefined,
      ckanId: 'something',
    })
  });
});
describe('[cli]download', () => {

  it.concurrent('should run download command', async () => {
    await runCommand('download');

    expect(setupContainer).toBeCalledWith({
      dataDir: expect.any(String),
      ckanId: 'ba000001',
    });

    expect(onDownload).toBeCalledWith({
      container: undefined,
      ckanId: 'ba000001',
      dataDir: expect.any(String),
    })
  });
  it.concurrent('should receive specified options', async () => {
    await runCommand('download', '-r', 'something', '-d', 'somewhere');

    expect(setupContainer).toBeCalledWith({
      dataDir: 'somewhere',
      ckanId: 'something',
    });

    expect(onDownload).toBeCalledWith({
      container: undefined,
      ckanId: 'something',
      dataDir: 'somewhere',
    })
  });
  it.concurrent('should receive specified options with long option names', async () => {
    await runCommand('download', '--resource', 'something', '--dataDir', 'somewhere');

    expect(setupContainer).toBeCalledWith({
      dataDir: 'somewhere',
      ckanId: 'something',
    });

    expect(onDownload).toBeCalledWith({
      container: undefined,
      ckanId: 'something',
      dataDir: 'somewhere',
    })
  });
});

describe('[cli] geocoding', () => {

  describe('regular usages', () => {
    it.concurrent('should run geocoding command', async () => {
      const inputFile = './somewhere/query.txt';

      await runCommand(inputFile);

      expect(setupContainer).toBeCalledWith({
        dataDir: expect.any(String),
        ckanId: 'ba000001',
      });

      expect(onGeocoding).toBeCalledWith({
        container: undefined,
        source: inputFile,
        format: expect.any(String),
        destination: undefined,
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
    });

    it.concurrent('case: abrg -f json -fuzzy ● <inputFile>', async () => {
      const inputFile = './somewhere/query.txt';

      const fuzzyChar = '●';
      await runCommand('-f', 'json', '--fuzzy', fuzzyChar, inputFile);

      expect(setupContainer).toBeCalledWith({
        dataDir: expect.any(String),
        ckanId: 'ba000001',
      });

      expect(onGeocoding).toBeCalledWith({
        container: undefined,
        source: inputFile,
        format: 'json',
        destination: undefined,
        fuzzy: fuzzyChar,
      });
    });

    it.concurrent('case: abrg -f ndjson <inputFile>', async () => {
      const inputFile = './somewhere/query.txt';

      await runCommand('-f', 'ndjson', inputFile);

      expect(setupContainer).toBeCalledWith({
        dataDir: expect.any(String),
        ckanId: 'ba000001',
      });

      expect(onGeocoding).toBeCalledWith({
        container: undefined,
        source: inputFile,
        format: 'ndjson',
        destination: undefined,
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
    });

    it.concurrent('case: abrg -d somewhere <inputFile>', async () => {
      const inputFile = './somewhere/query.txt';

      await runCommand('-d', 'somewhere', inputFile);

      expect(setupContainer).toBeCalledWith({
        dataDir: 'somewhere',
        ckanId: 'ba000001',
      });

      expect(onGeocoding).toBeCalledWith({
        container: undefined,
        source: inputFile,
        format: 'csv',
        destination: undefined,
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
    });
    
    it.concurrent('should receive outputFile option', async () => {
      const inputFile = './somewhere/query.txt';
      const outputFilee = './somewhere/result.csv';

      await runCommand(inputFile, outputFilee, '-f', 'csv');

      expect(setupContainer).toBeCalledWith({
        dataDir: expect.any(String),
        ckanId: 'ba000001',
      });

      expect(onGeocoding).toBeCalledWith({
        container: undefined,
        source: inputFile,
        format: 'csv',
        destination: outputFilee,
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
    });

    it.concurrent('should receive outputFile option, even if arguments order is incorrect', async () => {
      const inputFile = './somewhere/query.txt';
      const outputFilee = './somewhere/result.csv';

      await runCommand('-f', 'csv', inputFile, outputFilee);

      expect(setupContainer).toBeCalledWith({
        dataDir: expect.any(String),
        ckanId: 'ba000001',
      });

      expect(onGeocoding).toBeCalledWith({
        container: undefined,
        source: inputFile,
        format: 'csv',
        destination: outputFilee,
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
    });
  });

  describe('special case', () => {
    beforeAll(() => {
      jest.resetAllMocks();
    });

    it('should receive "-" as inputFile', async () => {
      const inputFile = '-';
  
      await runCommand(inputFile);
  
      expect(setupContainer).toBeCalledWith({
        dataDir: expect.any(String),
        ckanId: 'ba000001',
      });
  
      expect(onGeocoding).toBeCalledWith({
        container: undefined,
        source: SINGLE_DASH_ALTERNATIVE,
        format: 'csv',
        destination: undefined,
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
    });
  })
  
});

describe('[cli] error cases', () => {
  const buffer: string[] = [];
  const stdErr = jest.spyOn(console, 'error').mockImplementation(
    (line: string) => {
      buffer.push(line);
    });

  beforeEach(() => {
    buffer.length = 0;
    stdErr.mockClear();
  })

  afterAll(() => {
    stdErr.mockRestore();
  })
  
  it('should show the command help if no arguments', async () => {
    await runCommand();
    expect(stdErr).toBeCalled();
    expect(buffer.join("\n")).toContain('abr-geocoder version');

  });

  it('should occur an error if input file is invalid', async () => {
    
    await runCommand('invalidFilePathSuchAs1');
    expect(stdErr).toBeCalled();
    expect(buffer.join("\n")).toContain(
      AbrgMessage.toString(AbrgMessage.CANNOT_FIND_INPUT_FILE),
    );
  });
  
});

// Programmatically set arguments and execute the CLI script
const runCommand = async (...args: string[]) => {
  const dummyArgv = [
    'node', // Not used but a value is reqired at the index in the array
    'abrg', // Not used but a value is reqired at the index in the array
    ...args
  ];

  // Require the yargs CLI script
  return await main('test', ...dummyArgv);
}