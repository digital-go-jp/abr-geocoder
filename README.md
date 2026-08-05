# ABR Geocoder

[日本語](README.ja.md)

Japanese address processing tools using the Address Base Registry (ABR).

## Quickstart

```bash
cd quickstart
docker compose up -d
curl -s "http://localhost:3001/geocode?address=東京都千代田区紀尾井町1-3"
```

Includes test data (Tokyo prefecture/city/town). See [quickstart/README.md](quickstart/README.md) for details.

## Nationwide Data

Nationwide data, and residential/parcel data, need PostgreSQL. The
[docker-compose.yml](docker-compose.yml) at the repository root runs PostgreSQL,
abrdb and abrg together.

```bash
cp .env.example .env
# edit .env and set DB_PASSWORD

docker compose up -d postgres

# choose what to import
docker compose run --rm abrdb_app init --pref all --category all --pos

# download from ABR and load into PostgreSQL
docker compose run --rm abrdb_app import

# build the DuckDB cache from PostgreSQL
docker compose run --rm abrg_app cache build

# start the API server
docker compose up -d abrg_app
curl -s "http://localhost:3000/geocode?address=東京都千代田区紀尾井町1-3"
```

Data persists in three named volumes.

| Volume | Contents |
|--------|----------|
| `postgres_data` | the PostgreSQL database |
| `abrdb_data` | ABR archives as downloaded |
| `abrg_cache` | the DuckDB cache abrg reads |

`docker compose down` keeps them. Use `down -v` to start over.

See each README for per-command options:
- [abrdb/README.ja.md](abrdb/README.ja.md)
- [abrg/README.ja.md](abrg/README.ja.md)

## Data Source

This software uses the [Address Base Registry](https://www.digital.go.jp/policies/base_registry_address) (ABR).

See the [Terms of Service](https://www.digital.go.jp/policies/base_registry_address_tos) for data usage.

## License

[MIT](LICENSE)
