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

// Used by multiple binaries (abrg, abrdb) to ensure
// consistent and safe SQL generation across all tools.
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
