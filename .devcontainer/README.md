# Devcontainer 開発ガイド

ツールの使い方は各 README を参照:

- abrdb: [../abrdb/README.ja.md](../abrdb/README.ja.md)
- abrg: [../abrg/README.ja.md](../abrg/README.ja.md)
- abrg API 仕様: [../abrg/openapi/openapi.yml](../abrg/openapi/openapi.yml)

## 開発 Tips

### マウントされるボリューム

| コンテナ内 | ホスト側 | 中身 |
|---|---|---|
| `/root/.abrg/cache` | `.devcontainer/abrg_cache` | abrg の DuckDB キャッシュ |
| `/root/.abrdb/data` | `.devcontainer/abrdb_data` | ABR から取得したローデータ (abrdb のインポート元) |
| `/var/lib/postgresql/data` | `.devcontainer/postgres_data` | PostgreSQL データ |

### LOG_LEVEL を変更する

デフォルトで DEBUG ログが stderr に出る。パイプ処理時は上書きする:

```bash
LOG_LEVEL=info ./abrg match -i input.txt -o /dev/stdout -q
```

### DuckDB キャッシュを確認する

```bash
# テーブル一覧
duckdb ~/.abrg/cache/abrg.duckdb "SHOW TABLES;"

# 設定 (build_time, enabled_pref, enabled_category, abrdb_version など)
duckdb ~/.abrg/cache/abrg.duckdb "SELECT * FROM cache_config;"

# レコード数
duckdb ~/.abrg/cache/abrg.duckdb "SELECT COUNT(*) FROM cache_machiaza;"

# サンプル
duckdb ~/.abrg/cache/abrg.duckdb "SELECT * FROM cache_machiaza LIMIT 5;"
```

abrg server 稼働中のキャッシュを触る場合は `-readonly` を付ける:

```bash
duckdb -readonly ~/.abrg/cache/abrg.duckdb "SELECT COUNT(*) FROM cache_machiaza;"
```

### PostgreSQL を `psql` で確認する

```bash
psql -h postgres -U abruser -d abrdb -c '\dt'
psql -h postgres -U abruser -d abrdb -c 'SELECT config_key, config_value FROM abrdb_config;'
```

### ABR のローデータを確認する

`/root/.abrdb/data/` に ABR が公開している `.csv.zip` がダウンロードされる。

```bash
# ファイル一覧
ls /root/.abrdb/data/

# アーカイブの中身を一覧
unzip -l /root/.abrdb/data/mt_pref_all.csv.zip

# unzip で標準出力に展開
unzip -p /root/.abrdb/data/mt_pref_all.csv.zip | head

# DuckDB で読む (unzip を経由)
unzip -p /root/.abrdb/data/mt_pref_all.csv.zip | \
  duckdb -c "SELECT * FROM read_csv('/dev/stdin') LIMIT 5;"
```

### DuckDB キャッシュを作り直す

```bash
cd /workspace/abrg
./abrg cache build
```

### PostgreSQL を完全リセット

devcontainer を止めて `.devcontainer/postgres_data/` をホスト側で削除する。
