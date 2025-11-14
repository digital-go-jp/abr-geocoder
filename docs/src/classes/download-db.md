# Classes: Download（補足）

補足として、Download 階層で用いる DB・HTTP の役割を簡記します。

- `DownloadDiContainer` ダウンロード元 URL（DCAT）や保存先ディレクトリをカプセル化
- `DownloadDbController` ダウンロード状況/キャッシュ情報の保存（URL キャッシュなど）
- `HttpRequestAdapter` HTTP 実装の差し替えポイント

Download → SQLite → Cache の一連は `download-process.ts` が統括

