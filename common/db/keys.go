package db

// Database configuration keys for abrdb_config table
const (
	KeyABRDBVersion    = "abrdb_version"
	KeyEnabledPref     = "enabled_pref"
	KeyEnabledCategory = "enabled_category"
	KeyEnabledPos      = "enabled_pos"
	// KeyImportConfigProfile names the embedded import config profile chosen at
	// `abrdb init`; the YAML itself is resolved from the abrdb binary.
	KeyImportConfigProfile = "import_config_profile"
)
