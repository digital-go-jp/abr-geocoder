# Classes: Geocoder / Worker

## AbrGeocoder（`src/usecases/geocode/abr-geocoder.ts`）

責務:

- タスク整列（入力順の維持）とワーカープールへの投入
- 共有メモリ化した Trie バッファを初期化し、ワーカーへ配布

主なメソッド:

- `static create({container, numOfThreads, isSilentMode, signal})`
  - SQLite から Pref 一覧を取得
  - 各 Finder の `loadDataFile()` で ABRG2 を Buffer 読込
  - `toSharedMemory()` で共有メモリ化し、初期データを `GeocodeWorkerInitData` としてプールへ
  - スレッド数 < 2 or Jest 実行時はメインスレッドで `FakeWorkerThreadPool`
- `geocode(input)`
  - `WorkerPoolTaskInfo` 連結で順序を保持しつつ `WorkerThreadPool.run()` を呼ぶ
  - 結果は `flushResults()` で入力順に emit
- `close()` ワーカープールのクリーンアップ

## GeocodeTransform（`src/usecases/geocode/worker/geocode-worker.ts`）

責務:

- 住所処理のストリームパイプライン

パイプライン:

1) Normalize → Banchome 正規化
2) Pref → CountyAndCity → CityAndWard → Ward → Tokyo23（Ward/Town） → KyotoStreet → OazaChome
3) RsdtBlk → RsdtDsp → Parcel
4) GeocodeResultTransform（スコアリング/整形）

## WorkerThreadPool（`src/domain/services/thread/worker-thread-pool.ts`）

責務:

- N ワーカーに最大 M タスクを並列投入しつつ、バックプレッシャを制御

関連:

- `WorkerPoolTaskInfo` 入出力の順序管理
- `toSharedMemory`/`fromSharedMemory` で辞書バッファを共有

