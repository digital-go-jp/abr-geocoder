import {DependencyContainer, container} from "tsyringe";
import path from 'node:path';
import { commonInitialize } from "./common";

export const noralInitialize = async ({
  dataDir,
  ckanId,
}: {
  dataDir: string;
  ckanId: string;
}) => {

  container.register(
    'USER_AGENT',
    {
      useValue: 'curl/7.81.0',
    },
  );
  container.register('getDatasetUrl', {
    useValue: (ckanId: string) => {
      // return `http://localhost:8080/${ckanId}.zip`;
      return `https://catalog.registries.digital.go.jp/rc/api/3/action/package_show?id=${ckanId}`;
    },
  });

  const sqliteFilePath = path.join(dataDir, `${ckanId}.sqlite`);
  const schemaFilePath = path.join(__dirname, '..', '..', '..', `schema.sql`);
  await commonInitialize({
    schemaFilePath,
    sqliteFilePath,
    silent: false,
  });
};
