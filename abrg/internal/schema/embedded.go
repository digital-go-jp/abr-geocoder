package schema

import _ "embed"

// cacheSchemaYAML contains the embedded cache schema configuration.
//
//go:embed cache_schema.yaml
var cacheSchemaYAML []byte
