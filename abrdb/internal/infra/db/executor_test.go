package db

import (
	"testing"
)

func TestQueryExecutorClose_NilPool(t *testing.T) {
	executor := &QueryExecutor{pool: nil}

	err := executor.Close()
	if err != nil {
		t.Errorf("Close() with nil pool should return nil, got %v", err)
	}
}

func TestQueryExecutorPool_NilPool(t *testing.T) {
	executor := &QueryExecutor{pool: nil}

	pool := executor.Pool()
	if pool != nil {
		t.Error("Pool() with nil pool should return nil")
	}
}
