package env

import (
	"os"
	"testing"
)

func TestGetEnv(t *testing.T) {
	tests := []struct {
		name     string
		key      string
		setValue string
		setEnv   bool
		def      string
		want     string
	}{
		{
			name:     "returns value when env is set",
			key:      "TEST_GET_ENV_SET",
			setValue: "test_value",
			setEnv:   true,
			def:      "default",
			want:     "test_value",
		},
		{
			name:     "returns default when env is not set",
			key:      "TEST_GET_ENV_UNSET",
			setValue: "",
			setEnv:   false,
			def:      "default",
			want:     "default",
		},
		{
			name:     "returns empty string when env is set to empty",
			key:      "TEST_GET_ENV_EMPTY",
			setValue: "",
			setEnv:   true,
			def:      "default",
			want:     "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clean up before test
			os.Unsetenv(tt.key)

			if tt.setEnv {
				os.Setenv(tt.key, tt.setValue)
				defer os.Unsetenv(tt.key)
			}

			got := GetEnv(tt.key, tt.def)
			if got != tt.want {
				t.Errorf("GetEnv(%q, %q) = %q, want %q", tt.key, tt.def, got, tt.want)
			}
		})
	}
}
