package schema

import _ "embed"

// DefaultConfigYAML contains the embedded default import configuration.
//
//go:embed config_default.yaml
var DefaultConfigYAML []byte
