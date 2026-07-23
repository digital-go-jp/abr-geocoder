package repository

import "database/sql"

func scanStr(ns sql.Null[string]) string {
	if ns.Valid {
		return ns.V
	}
	return ""
}

func scanOpt[T any](n sql.Null[T]) *T {
	if n.Valid {
		v := n.V
		return &v
	}
	return nil
}
