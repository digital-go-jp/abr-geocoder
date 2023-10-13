// reflect-metadata is necessary for DI
import 'reflect-metadata';

import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { onDownload, onGeocoding, onUpdateCheck } from '../controllers';
import { AbrgMessage, OutputFormat, bubblingFindFile } from '../domain';
import { getPackageInfo, main, parseHelper } from '../index';
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

jest.mock('../interface-adapter/packagejson');

describe('cli', () => {
  describe('getPackageInfo', () => {
    it('should occur an error if bubblingFindFile() returns undefined', async () => {

      await expect(getPackageInfo())
      .resolves
      .toMatchObject({
        version: '0.0.0',
        description: 'unit test'
      });
    });

    it('should occur an error if bubblingFindFile() returns undefined', async () => {
      const orgMock = (bubblingFindFile as jest.Mock).getMockImplementation;
      (bubblingFindFile as jest.Mock).mockImplementation(async () => {
        return undefined;
      });

      await expect(getPackageInfo())
      .rejects
      .toThrow(AbrgMessage.toString(AbrgMessage.CANNOT_FIND_PACKAGE_JSON_FILE));

      (bubblingFindFile as jest.Mock).mockImplementation(orgMock);
    });
  });

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

  describe('update-check', () => {

    it.concurrent('should run update-check command', async () => {
      await runCommand('update-check');

      expect(onUpdateCheck).toBeCalledWith({
        dataDir: expect.any(String),
        ckanId: 'ba000001',
      })
    });
    it.concurrent('should receive specified options', async () => {
      await runCommand('update-check', '-r', 'something', '-d', 'somewhere');

      expect(onUpdateCheck).toBeCalledWith({
        dataDir: 'somewhere',
        ckanId: 'something',
      })
    });
    it.concurrent('should receive specified options with long option names', async () => {
      await runCommand('update-check', '--resource', 'something', '--dataDir', 'somewhere');

      expect(onUpdateCheck).toBeCalledWith({
        dataDir: 'somewhere',
        ckanId: 'something',
      })
    });
  });
  describe('download', () => {

    it.concurrent('should run download command', async () => {
      await runCommand('download');

      expect(onDownload).toBeCalledWith({
        dataDir: expect.any(String),
        ckanId: 'ba000001',
      })
    });
    it.concurrent('should receive specified options', async () => {
      await runCommand('download', '-r', 'something', '-d', 'somewhere');

      expect(onDownload).toBeCalledWith({
        container: undefined,
        ckanId: 'something',
        dataDir: 'somewhere',
      })
    });
    it.concurrent('should receive specified options with long option names', async () => {
      await runCommand('download', '--resource', 'something', '--dataDir', 'somewhere');

      expect(onDownload).toBeCalledWith({
        container: undefined,
        ckanId: 'something',
        dataDir: 'somewhere',
      })
    });
  });

  describe(' geocoding', () => {

    describe('regular usages', () => {
      it.concurrent('should run geocoding command', async () => {
        const inputFile = './somewhere/query.txt';

        await runCommand(inputFile);

        expect(onGeocoding).toBeCalledWith({
          ckanId: 'ba000001',
          dataDir: expect.any(String),
          source: inputFile,
          format: expect.any(String),
          destination: undefined,
          fuzzy: undefined,
        });
      });

      it.concurrent('case: abrg -f json -fuzzy <inputFile>', async () => {
        const inputFile = './somewhere/query.txt';

        await runCommand('-f', OutputFormat.JSON, '--fuzzy', inputFile);

        expect(onGeocoding).toBeCalledWith({
          ckanId: 'ba000001',
          dataDir: expect.any(String),
          source: inputFile,
          format: OutputFormat.JSON,
          destination: undefined,
          fuzzy: DEFAULT_FUZZY_CHAR,
        });
      });

      it.concurrent('case: abrg -f json --fuzzy ● <inputFile>', async () => {
        const inputFile = './somewhere/query.txt';

        const fuzzyChar = '●';
        await runCommand('-f', OutputFormat.JSON, '--fuzzy', fuzzyChar, inputFile);

        expect(onGeocoding).toBeCalledWith({
          ckanId: 'ba000001',
          dataDir: expect.any(String),
          source: inputFile,
          format: OutputFormat.JSON,
          destination: undefined,
          fuzzy: fuzzyChar,
        });

      });

      it.concurrent('case: abrg -f ndjson <inputFile>', async () => {
        const inputFile = './somewhere/query.txt';

        await runCommand('-f', OutputFormat.NDJSON, inputFile);

        expect(onGeocoding).toBeCalledWith({
          ckanId: 'ba000001',
          dataDir: expect.any(String),
          source: inputFile,
          format: OutputFormat.NDJSON,
          destination: undefined,
          fuzzy: undefined,
        });
      });

      it.concurrent('case: abrg -d somewhere <inputFile>', async () => {
        const inputFile = './somewhere/query.txt';

        await runCommand('-d', 'somewhere', inputFile);

        expect(onGeocoding).toBeCalledWith({
          ckanId: 'ba000001',
          dataDir: expect.any(String),
          source: inputFile,
          format: OutputFormat.CSV,
          destination: undefined,
          fuzzy: undefined,
        });
      });
      
      it.concurrent('should receive outputFile option', async () => {
        const inputFile = './somewhere/query.txt';
        const outputFile = './somewhere/result.csv';

        await runCommand(inputFile, outputFile, '-f', OutputFormat.CSV);

        expect(onGeocoding).toBeCalledWith({
          ckanId: 'ba000001',
          dataDir: expect.any(String),
          source: inputFile,
          format: OutputFormat.CSV,
          destination: outputFile,
          fuzzy: undefined,
        });
      });

      it.concurrent('should receive outputFile option, even if arguments order is incorrect', async () => {
        const inputFile = './somewhere/query.txt';
        const outputFile = './somewhere/result.csv';

        await runCommand('-f', 'csv', inputFile, outputFile);

        expect(onGeocoding).toBeCalledWith({
          ckanId: 'ba000001',
          dataDir: expect.any(String),
          source: inputFile,
          format: OutputFormat.CSV,
          destination: outputFile,
          fuzzy: undefined,
        });
      });
    });

  });

  describe(' special cases', () => {

    beforeAll(() => {
      jest.clearAllMocks();
    });

    it('should receive "-" as inputFile', async () => {
      const inputFile = '-';

      await runCommand(inputFile);

      expect(onGeocoding).toBeCalledWith({
        ckanId: 'ba000001',
        dataDir: expect.any(String),
        source: SINGLE_DASH_ALTERNATIVE,
        format: OutputFormat.CSV,
        destination: undefined,
        fuzzy: undefined,
      });

    });

    it('should show the command help if no arguments', async () => {
      const buffer: string[] = [];
      const stdErr = jest.spyOn(console, 'error').mockImplementation(
        (line: string) => {
          buffer.push(line);
        });


      await runCommand();
      expect(stdErr).toBeCalled();
      expect(buffer.join("\n")).toContain('abr-geocoder version');

      stdErr.mockRestore();
    });

    it('should occur an error if input file is invalid', async () => {
      
      const buffer: string[] = [];
      const stdErr = jest.spyOn(console, 'error').mockImplementation(
        (line: string) => {
          buffer.push(line);
        });

      await runCommand('invalidFilePathSuchAs1');
      expect(stdErr).toBeCalled();
      expect(buffer.join("\n")).toContain(
        AbrgMessage.toString(AbrgMessage.CANNOT_FIND_INPUT_FILE),
      );
      stdErr.mockRestore();
    });
    
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