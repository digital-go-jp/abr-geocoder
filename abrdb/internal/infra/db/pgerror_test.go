package db

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestIsUndefinedTableError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "undefined table error",
			err:  &pgconn.PgError{Code: "42P01"},
			want: true,
		},
		{
			name: "wrapped undefined table error",
			err:  errors.Join(errors.New("query failed"), &pgconn.PgError{Code: "42P01"}),
			want: true,
		},
		{
			name: "different pg error code",
			err:  &pgconn.PgError{Code: "42703"},
			want: false,
		},
		{
			name: "non-pg error",
			err:  errors.New("some error"),
			want: false,
		},
		{
			name: "nil error",
			err:  nil,
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsUndefinedTableError(tt.err); got != tt.want {
				t.Errorf("IsUndefinedTableError() = %v, want %v", got, tt.want)
			}
		})
	}
}
