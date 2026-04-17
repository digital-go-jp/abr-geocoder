package duckdb

import (
	"strings"
	"testing"
)

func TestAlias(t *testing.T) {
	tests := []struct {
		name     string
		hasPos   bool
		column   string
		expected string
	}{
		{
			name:     "with position data",
			hasPos:   true,
			column:   "lg_code",
			expected: "t.lg_code",
		},
		{
			name:     "without position data",
			hasPos:   false,
			column:   "lg_code",
			expected: "lg_code",
		},
		{
			name:     "with position - complex column",
			hasPos:   true,
			column:   "oaza_cho",
			expected: "t.oaza_cho",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := alias(tt.hasPos, tt.column)
			if got != tt.expected {
				t.Errorf("alias(%v, %q) = %q, want %q", tt.hasPos, tt.column, got, tt.expected)
			}
		})
	}
}

func TestEscapeSQLLiteral(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "no escape needed",
			input:    "hello",
			expected: "hello",
		},
		{
			name:     "single quote",
			input:    "it's",
			expected: "it''s",
		},
		{
			name:     "multiple single quotes",
			input:    "it's John's",
			expected: "it''s John''s",
		},
		{
			name:     "backslash",
			input:    "path\\to\\file",
			expected: "path\\\\to\\\\file",
		},
		{
			name:     "mixed special chars",
			input:    "it's a\\path",
			expected: "it''s a\\\\path",
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := escapeSQLLiteral(tt.input)
			if got != tt.expected {
				t.Errorf("escapeSQLLiteral(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestConvertFullWidthNumbers(t *testing.T) {
	tests := []struct {
		name string
		col  string
	}{
		{
			name: "simple column",
			col:  "chome",
		},
		{
			name: "aliased column",
			col:  "t.chome",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := convertFullWidthNumbers(tt.col)
			// Verify it contains the translate function with the column
			if !strings.Contains(got, "translate("+tt.col) {
				t.Errorf("convertFullWidthNumbers(%q) should contain translate(%s, got %q", tt.col, tt.col, got)
			}
			// Verify it contains full-width numbers
			if !strings.Contains(got, "０１２３４５６７８９") {
				t.Errorf("convertFullWidthNumbers(%q) should contain full-width numbers, got %q", tt.col, got)
			}
			// Verify it contains half-width numbers
			if !strings.Contains(got, "0123456789") {
				t.Errorf("convertFullWidthNumbers(%q) should contain half-width numbers, got %q", tt.col, got)
			}
		})
	}
}

func TestColumnSpecSQL(t *testing.T) {
	tests := []struct {
		name     string
		spec     columnSpec
		expected string
	}{
		{
			name: "expression with alias",
			spec: columnSpec{
				expr:  "CAST(col AS INT)",
				alias: "col_int",
			},
			expected: "CAST(col AS INT) as col_int",
		},
		{
			name: "simple column with empty alias",
			spec: columnSpec{
				expr:  "lg_code",
				alias: "",
			},
			expected: "lg_code as ",
		},
		{
			name: "aliased column reference",
			spec: columnSpec{
				expr:  "t.lg_code",
				alias: "lg_code",
			},
			expected: "t.lg_code as lg_code",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.spec.sql()
			if got != tt.expected {
				t.Errorf("columnSpec.sql() = %q, want %q", got, tt.expected)
			}
		})
	}
}
