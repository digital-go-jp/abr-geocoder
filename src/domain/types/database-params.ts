
export type DatabaseType = 'sqlite3';

export type Sqlite3Params = {
  type: 'sqlite3',
  dataDir: string;
  schemaDir: string;
};

export type MySqlParams = {
  type: 'mysql',
  host: string;
  port: number;
  username: string;
  password: string;
  schemaDir: string;
};

export type DatabaseParams = Sqlite3Params | MySqlParams;

