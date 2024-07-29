import { makeDirIfNotExists } from '@domain/services/make-dir-if-not-exists';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import os from 'node:os';
import path from 'node:path';

export class EnvProvider {
  static readonly DEFAULT_ABRG_DIR: string = path.join(os.homedir(), '.abr-geocoder');
  
  public readonly hostname: string = 'catalog.registries.digital.go.jp';
  public readonly userAgent: string = 'curl/7.81.0';
  public readonly nodeRuntimeVersion: number[];

  constructor() {
    this.nodeRuntimeVersion = Array
      .from(process.version.matchAll(RegExpEx.create('(\d+)', 'g')))
      .map(match => parseInt(match[0]));
  }

  availableParallelism() {
    return this.nodeRuntimeVersion[0] > 18 ? os.availableParallelism() : os.cpus().length;
  }
}