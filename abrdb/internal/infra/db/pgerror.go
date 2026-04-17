package db

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// PostgreSQL error codes
// See: https://www.postgresql.org/docs/current/errcodes-appendix.html
const (
	// Class 42 - Syntax Error or Access Rule Violation
	PGCodeUndefinedTable = "42P01" // relation does not exist
)

func IsUndefinedTableError(err error) bool {
	return hasPgErrorCode(err, PGCodeUndefinedTable)
}

func hasPgErrorCode(err error, code string) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == code
	}
	return false
}
