import fs from 'node:fs';

export interface packageJsonMeta {
  description: string;
  version: string;
}

export const parsePackageJson = ({
  filePath,
}: {
  filePath: string;
}): packageJsonMeta => {
  const packageJson = fs.readFileSync(filePath, 'utf8');
  const {description, version} = JSON.parse(packageJson);
  return {
    description,
    version,
  };
};
