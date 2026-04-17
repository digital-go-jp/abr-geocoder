package repository

import "database/sql"

func scanStr(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

func scanOpt(ns sql.NullString) *string {
	if ns.Valid {
		s := ns.String
		return &s
	}
	return nil
}

func scanOptFloat(nf sql.NullFloat64) *float64 {
	if nf.Valid {
		f := nf.Float64
		return &f
	}
	return nil
}
