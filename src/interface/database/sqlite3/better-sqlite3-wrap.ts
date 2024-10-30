/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import BetterSqlite3, { Statement } from "better-sqlite3";
import { LRUCache } from "lru-cache";
import stringHash from "string-hash";
import fs from "node:fs";
import { AbrgError, AbrgErrorLevel } from "@domain/types/messages/abrg-error";
import { AbrgMessage } from "@domain/types/messages/abrg-message";

export class Sqlite3Wrapper {
  private readonly cache = new LRUCache<number, Statement<unknown[], unknown>>({
    max: 20,
  });

  protected driver: BetterSqlite3.Database;

  constructor(params: Required<{
    sqliteFilePath: string;
    readonly: boolean,
  }>) {
    if (!fs.existsSync(params.sqliteFilePath)) {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_OPEN_THE_DATABASE,
        level: AbrgErrorLevel.ERROR,
      });
    }
    this.driver = new BetterSqlite3(params.sqliteFilePath, {
      readonly: params.readonly,
    });

    if (params.readonly) {
      // 読み込み専用にしてパフォーマンスの向上を図る

      /**
       * デフォルトでは、SQLite は DELETE または WAL（Write-Ahead Logging）モードが有効になっており、
       * これが書き込みトランザクション用のオーバーヘッドを追加します。
       * 読み込み専用でファイルを開く場合、ジャーナルモードを OFF に設定することで、
       * 不要なログを生成せず、読み込みパフォーマンスを向上させることができます。
       */
      this.driver.pragma('journal_mode = OFF');

      /**
       * 通常、SQLite はデータの整合性を保つためにファイルの同期を行いますが、
       * 読み込み専用モードではこの設定を OFF にすることで同期処理を省略し、パフォーマンスを向上させられます。
       */
      this.driver.pragma('synchronous = OFF');

      /**
       * キャッシュサイズを調整することで、頻繁に読み込まれるデータをメモリ上に保持し、
       * ディスクアクセスを減らすことができます。
       * デフォルト値は -2000（ページ数で設定）ですが、
       * キャッシュを増やすことでパフォーマンスが向上することが多いです。
       */
      this.driver.pragma('cache_size = 20000');

      /**
       * 一時データの保存先をメモリに指定することで、ディスクアクセスが不要になり、
       * パフォーマンスが向上します。
       * これにより、ソートや結合処理などの際の一時データもメモリに保持されます。
       */
      this.driver.pragma('temp_store = MEMORY');

      /**
       * mmap（メモリマップ）を有効にすると、SQLite はファイル全体をメモリにマップしてアクセスできます。
       * mmap_size を適切な値に設定することで、ディスクからの読み込みが高速化され、
       * 特にランダムアクセスが多い場合に有効です。大きすぎないようにシステムのメモリ状況に合わせて設定するのが理想です。
       */
      this.driver.pragma('mmap_size = 268435456'); // 例として 256MB を設定

      /**
       * read_uncommitted を TRUE に設定すると、トランザクション分離レベルが READ UNCOMMITTED になります。
       * これは通常、同時書き込みが発生するシナリオで設定しますが、
       * 読み込み専用で使用する場合も設定しておくと、少しパフォーマンスが向上する可能性があります。
       */
      this.driver.pragma('read_uncommitted = TRUE');
    } else {
      this.driver.pragma('journal_mode = WAL');
    }
  }

  prepare<P extends unknown[] | {} = unknown[], R = unknown>(sql: string) {
    const key = stringHash(sql);
    if (this.cache.has(key)) {
      return this.cache.get(key) as Statement<P, R>;
    }
    const statement = this.driver.prepare<P, R>(sql);
    this.cache.set(key, statement);
    return statement;
  }
}
