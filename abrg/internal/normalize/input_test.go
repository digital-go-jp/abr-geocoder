package normalize

import (
	"errors"
	"os"
	"strings"
	"testing"
)

func TestBasicNormalizeInput(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr error
	}{
		{name: "address", input: "東京都千代田区紀尾井町１番３号", want: "東京都千代田区紀尾井町1番3号"},
		{name: "address with a comment", input: "東京都千代田区紀尾井町1-3 // 本社", want: "東京都千代田区紀尾井町1-3"},
		{name: "empty", input: "", wantErr: ErrEmptyAddress},
		{name: "whitespace only", input: " \t\u3000", wantErr: ErrEmptyAddress},
		{name: "line comment only", input: "// memo", wantErr: ErrEmptyAddress},
		{name: "block comment only", input: "/* memo */", wantErr: ErrEmptyAddress},
		{name: "quotes only", input: `""`, wantErr: ErrEmptyAddress},
		{name: "BOM only", input: "\uFEFF", wantErr: ErrEmptyAddress},
		{name: "longest address", input: strings.Repeat("あ", DefaultMaxAddressLength), want: strings.Repeat("あ", DefaultMaxAddressLength)},
		{name: "address too long", input: strings.Repeat("あ", DefaultMaxAddressLength+1), wantErr: ErrAddressTooLong},
		{
			name:  "comment does not count toward the length",
			input: "東京都千代田区紀尾井町1-3 // " + strings.Repeat("あ", DefaultMaxAddressLength),
			want:  "東京都千代田区紀尾井町1-3",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := BasicNormalizeInput(tt.input)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("BasicNormalizeInput(%q) error = %v, want %v", tt.input, err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("BasicNormalizeInput(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestConfigureMaxAddressLength(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		set     bool
		want    int
		wantErr bool
	}{
		{name: "unset keeps the default", want: DefaultMaxAddressLength},
		{name: "raised", value: "256", set: true, want: 256},
		{name: "smallest", value: "1", set: true, want: 1},
		{name: "largest", value: "1000", set: true, want: 1000},
		{name: "zero", value: "0", set: true, wantErr: true},
		{name: "above the largest", value: "1001", set: true, wantErr: true},
		{name: "not a number", value: "abc", set: true, wantErr: true},
		{name: "empty", value: "", set: true, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Cleanup(func() { maxAddressLength = DefaultMaxAddressLength })
			// t.Setenv restores the variable afterwards, including when it is then unset.
			t.Setenv(EnvMaxAddressLength, tt.value)
			if !tt.set {
				os.Unsetenv(EnvMaxAddressLength)
			}

			err := ConfigureMaxAddressLength()
			if (err != nil) != tt.wantErr {
				t.Fatalf("ConfigureMaxAddressLength() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && maxAddressLength != tt.want {
				t.Errorf("maxAddressLength = %d, want %d", maxAddressLength, tt.want)
			}
		})
	}
}

func TestBasicNormalizeInputConfiguredLength(t *testing.T) {
	t.Cleanup(func() { maxAddressLength = DefaultMaxAddressLength })
	t.Setenv(EnvMaxAddressLength, "256")
	if err := ConfigureMaxAddressLength(); err != nil {
		t.Fatal(err)
	}

	long := strings.Repeat("あ", 256)
	if got, err := BasicNormalizeInput(long); err != nil || got != long {
		t.Errorf("BasicNormalizeInput(256 chars) = %q, %v, want the input and no error", got, err)
	}

	_, err := BasicNormalizeInput(long + "あ")
	if !errors.Is(err, ErrAddressTooLong) {
		t.Fatalf("BasicNormalizeInput(257 chars) error = %v, want %v", err, ErrAddressTooLong)
	}
	if want := "address too long: max 256 characters"; err.Error() != want {
		t.Errorf("error message = %q, want %q", err.Error(), want)
	}
}
