import {autoInjectable} from "tsyringe";
import { Command } from "commander";
import { Database } from "better-sqlite3";
import { onDownloadAction } from "./onDownloadAction";
import { onUpdateCheckAction } from "./onUpdateCheckAction";

export class AbrgCommander extends Command {
  constructor({
    description,
    version,
  }: {
    description: string,
    version: string,
  }) {
    super('abrg')
    this.description(description);
    this.version(version);
    this.addDownloadCommand();
    this.addUpdateCheckCommand();
  }

  private addUpdateCheckCommand() {
    this.command('update-check')
      .description(
        'アドレス・ベース・レジストリのデータが最新であることを確認します'
      )
      .option(
        '-d|--data <dataPath>',
        'アドレス・ベース・レジストリのデータを格納するディレクトリを指定する。指定されていない場合はデフォルトのディレクトリを参照します。'
      )
      .option(
        '-s|--source <sourceId>',
        'アドレス・ベース・レジストリのデータソースID。全国データは `ba000001` をお使いください。',
        'ba000001'
      )
      .action(onUpdateCheckAction);
  }

  private addDownloadCommand() {

    this.command('download')
      .description(
        'アドレス・ベース・レジストリの最新データをCKANからダウンロードする'
      )
      .option(
        '-d|--data <dataPath>',
        'アドレス・ベース・レジストリのデータを格納するディレクトリを指定する。指定されていない場合はデフォルトのディレクトリを参照します。'
      )
      .option(
        '-s|--source <sourceId>',
        'アドレス・ベース・レジストリのデータソースID。全国データは `ba000001` をお使いください。',
        'ba000001'
      )
      .action(onDownloadAction);
  }
}
