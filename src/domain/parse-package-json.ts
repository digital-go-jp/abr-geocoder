import fs from 'node:fs';
import { packageJsonMeta } from './package-json-meta';

export const parsePackageJson = ({
  filePath,
}: {
  filePath: string;
}): packageJsonMeta => {
  const packageJson = fs.readFileSync(filePath, 'utf8');
  const { description, version } = JSON.parse(packageJson);
  return {
    description,
    version,
  };
};
