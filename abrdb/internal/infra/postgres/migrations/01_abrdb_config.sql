DROP TABLE IF EXISTS abrdb_config CASCADE;

CREATE TABLE IF NOT EXISTS abrdb_config (
    config_key   TEXT PRIMARY KEY,
    config_value TEXT NOT NULL,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);