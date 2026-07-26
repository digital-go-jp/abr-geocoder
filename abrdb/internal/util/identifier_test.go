package util

import "testing"

func TestQuoteIdentifier(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		want    string
		wantErr bool
	}{
		{name: "plain table name", in: "mt_town_unified", want: `"mt_town_unified"`},
		{name: "leading underscore", in: "_tmp", want: `"_tmp"`},
		{name: "digits allowed after first char", in: "t2", want: `"t2"`},
		{name: "empty", in: "", wantErr: true},
		{name: "leading digit", in: "1table", wantErr: true},
		{name: "upper case would not match unquoted DDL", in: "MtTown", wantErr: true},
		{name: "embedded quote", in: `mt"; DROP TABLE x; --`, wantErr: true},
		{name: "space", in: "mt town", wantErr: true},
		{name: "semicolon", in: "mt_town;", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := QuoteIdentifier(tt.in)
			if (err != nil) != tt.wantErr {
				t.Fatalf("QuoteIdentifier(%q) error = %v, wantErr %v", tt.in, err, tt.wantErr)
			}
			if err == nil && got != tt.want {
				t.Errorf("QuoteIdentifier(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}
