#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import "reflect-metadata";

import { AbrgCommander } from "./AbrgCommander";

export interface packageJsonMeta {
  description: string;
  version: string;
}

const parsePackageJson = async ({
  filePath,
}: {
  filePath: string;
}): Promise<packageJsonMeta> => {
  const packageJson = await fs.promises.readFile(filePath, 'utf8');
  const {description, version} = JSON.parse(packageJson);
  return {
    description,
    version,
  };
}
const main = async() => {
  const packageJsonPath = path.join(__dirname, '../../package.json');
  const {description, version} = await parsePackageJson({
    filePath: packageJsonPath,
  });
;
  const cliApp = new AbrgCommander({
    description,
    version,
  });
  cliApp.parse();
};

main();
