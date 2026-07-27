package db

import (
	"fmt"
	"strconv"
	"strings"
)

// DuckDB CREATE SECRET does not support parameterized queries.
func SqlEscape(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}

// BuildPostgresAttachSQL returns the ATTACH statement that links the "pg"
// alias to PostgreSQL through the named secret. sslmode rides on the ATTACH
// connection string because DuckDB's postgres SECRET type does not accept
// sslmode as a field; an empty sslMode is omitted so libpq uses its default.
func BuildPostgresAttachSQL(sslMode, secretName string, readOnly bool) string {
	conn := ""
	if sslMode != "" {
		conn = "sslmode=" + SqlEscape(sslMode)
	}
	options := "TYPE postgres, SECRET " + secretName
	if readOnly {
		options = "TYPE postgres, READ_ONLY, SECRET " + secretName
	}
	return fmt.Sprintf("ATTACH '%s' AS pg (%s)", conn, options)
}

// BuildPostgresSecretSQL builds the CREATE SECRET statement shared by abrg
// and abrdb so both binaries generate consistent and safe SQL.
//
// Security notes:
// - Port value is validated: must be numeric and within range 1-65535
// - String parameters are properly escaped using SqlEscape (single quotes doubled)
// - Invalid port values are silently omitted (DuckDB will use default if needed)
// - Out-of-range ports (e.g., -1, 0, 65536, 99999) are rejected
//
// DuckDB limitation: CREATE SECRET does not support parameterized queries,
// so manual string escaping is necessary.
func BuildPostgresSecretSQL(cfg DBConfig, secretName string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "CREATE OR REPLACE SECRET %s (TYPE postgres", secretName)

	if cfg.Host != "" {
		fmt.Fprintf(&b, ", HOST '%s'", SqlEscape(cfg.Host))
	}

	if cfg.Port != "" {
		// Invalid port is omitted; DuckDB uses default.
		if port, err := strconv.Atoi(cfg.Port); err == nil && port >= 1 && port <= 65535 {
			fmt.Fprintf(&b, ", PORT %d", port)
		}
	}

	if cfg.Database != "" {
		fmt.Fprintf(&b, ", DATABASE '%s'", SqlEscape(cfg.Database))
	}

	if cfg.User != "" {
		fmt.Fprintf(&b, ", USER '%s'", SqlEscape(cfg.User))
	}

	if cfg.Password != "" {
		fmt.Fprintf(&b, ", PASSWORD '%s'", SqlEscape(cfg.Password))
	}

	b.WriteString(")")
	return b.String()
}
