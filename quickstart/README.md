# Quickstart

Try the geocoder API with bundled Tokyo test data (pref/city/machiaza only).

## Start

```bash
cd quickstart
docker compose up -d
```

## Usage

```bash
# Health check
curl -s http://localhost:3001/health

# Match address against ABR data
curl -s "http://localhost:3001/match?address=東京都千代田区紀尾井町1番3号"

# Geocode (address → coordinates)
curl -s "http://localhost:3001/geocode?address=東京都千代田区紀尾井町1-3"

# Reverse geocode (coordinates → address, experimental)
curl -s "http://localhost:3001/reverse?lat=35.679107&lon=139.736394"

```

## Stop

```bash
docker compose down
```

## Next Steps

For nationwide data or residential/parcel data, see [abrdb](../abrdb/README.ja.md) and [abrg](../abrg/README.ja.md).
