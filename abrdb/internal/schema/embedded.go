package schema

import (
	_ "embed"
	"fmt"
	"maps"
	"slices"
	"strings"
)

// DefaultProfile is the import config profile used when none is specified.
const DefaultProfile = "default"

//go:embed config_default.yaml
var defaultConfigYAML []byte

//go:embed config_full.yaml
var fullConfigYAML []byte

// profiles maps profile names to embedded import config YAML. The database
// stores only the profile name, so the import config always comes from the
// running binary and config changes take effect on binary update.
var profiles = map[string][]byte{
	DefaultProfile: defaultConfigYAML,
	"full":         fullConfigYAML,
}

// ProfileNames returns the available profile names in sorted order.
func ProfileNames() []string {
	return slices.Sorted(maps.Keys(profiles))
}

// ProfileYAML returns the embedded import config YAML for the named profile.
func ProfileYAML(name string) ([]byte, error) {
	data, ok := profiles[name]
	if !ok {
		return nil, fmt.Errorf("unknown import config profile %q (available: %s)", name, strings.Join(ProfileNames(), ", "))
	}
	return data, nil
}

// LoadProfile parses the embedded import config for the named profile.
func LoadProfile(name string) (*ImportConfig, error) {
	data, err := ProfileYAML(name)
	if err != nil {
		return nil, err
	}
	return ParseImportConfig(data)
}
