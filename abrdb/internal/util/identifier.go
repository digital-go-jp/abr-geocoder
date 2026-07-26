package util

import (
	"fmt"
	"regexp"
)

// identPattern matches an unquoted lower-case SQL identifier. Restricting to
// lower case keeps the quoted form equal to what unquoted DDL created
// (PostgreSQL folds unquoted identifiers to lower case).
var identPattern = regexp.MustCompile(`^[a-z_][a-z0-9_]*$`)

// QuoteIdentifier validates that name is a plain lower-case SQL identifier
// and returns it double-quoted. Identifiers interpolated into SQL come from
// configuration, not user input; validation turns a malformed config into an
// error instead of an injection vector.
func QuoteIdentifier(name string) (string, error) {
	if !identPattern.MatchString(name) {
		return "", fmt.Errorf("invalid SQL identifier %q", name)
	}
	return `"` + name + `"`, nil
}
