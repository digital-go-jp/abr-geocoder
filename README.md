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

## Next Steps

For nationwide data or residential/parcel data:

1. Import ABR data to PostgreSQL with **abrdb**
2. Build cache and start server with **abrg**

See each README for details:
- [abrdb/README.ja.md](abrdb/README.ja.md)
- [abrg/README.ja.md](abrg/README.ja.md)

## Data Source

This software uses the [Address Base Registry](https://www.digital.go.jp/policies/base_registry_address) (ABR).

See the [Terms of Service](https://www.digital.go.jp/policies/base_registry_address_tos) for data usage.

## License

[MIT](LICENSE)
