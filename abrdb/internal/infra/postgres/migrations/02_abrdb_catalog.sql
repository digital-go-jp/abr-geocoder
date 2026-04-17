DROP TABLE IF EXISTS abrdb_catalog CASCADE;

CREATE TABLE IF NOT EXISTS abrdb_catalog (
    -- File identification
    file_type          TEXT NOT NULL,
    file_category      TEXT NOT NULL,
    pref_code          SMALLINT NOT NULL,
    file_key           TEXT NOT NULL,  -- For pairing text/pos files (e.g., "47", "473014", "all")

    -- File location
    filename           TEXT NOT NULL UNIQUE,  -- Filename only

    -- File metadata
    last_modified      TIMESTAMP NOT NULL,      -- Last modification timestamp
    source_url         TEXT NOT NULL,           -- Full download URL

    -- Processing status
    needs_download     BOOLEAN DEFAULT TRUE,
    needs_import       BOOLEAN DEFAULT FALSE,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY(file_type, file_category, filename)
);

CREATE INDEX IF NOT EXISTS idx_abrdb_catalog_type_category ON abrdb_catalog(file_type, file_category);
CREATE INDEX IF NOT EXISTS idx_abrdb_catalog_needs_import ON abrdb_catalog(needs_import);
CREATE INDEX IF NOT EXISTS idx_abrdb_catalog_needs_download ON abrdb_catalog(needs_download);
