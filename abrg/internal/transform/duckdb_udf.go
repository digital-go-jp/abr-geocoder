package transform

import (
	"database/sql/driver"

	"github.com/duckdb/duckdb-go/v2"
)

// TextForDBUDF implements a DuckDB scalar function for text transformation.
type TextForDBUDF struct{}

// Config returns the UDF configuration with input and output types.
func (*TextForDBUDF) Config() duckdb.ScalarFuncConfig {
	varcharInfo, _ := duckdb.NewTypeInfo(duckdb.TYPE_VARCHAR)
	return duckdb.ScalarFuncConfig{
		InputTypeInfos: []duckdb.TypeInfo{varcharInfo},
		ResultTypeInfo: varcharInfo,
	}
}

// Executor returns the function executor for text standardization.
func (*TextForDBUDF) Executor() duckdb.ScalarFuncExecutor {
	return duckdb.ScalarFuncExecutor{
		RowExecutor: func(values []driver.Value) (any, error) {
			if values[0] == nil {
				return nil, nil
			}

			// Call textForDB function (excludes AddColon since DB records already have colons)
			result, _ := textForDB(values[0].(string))
			return result, nil
		},
	}
}
