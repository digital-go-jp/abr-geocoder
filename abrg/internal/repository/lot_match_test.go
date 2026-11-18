package repository

import (
	"context"
	"testing"
)

func TestParcelLotMatch(t *testing.T) {
	repo := newFixtureRepo(t)
	// Parcel 12 is recorded only with prc_num2.
	if _, err := repo.db.ExecContext(context.Background(),
		`INSERT INTO cache_parcel (pref_code, lg_code, machiaza_id, prc_id, prc_num1, prc_num2)
		 VALUES (13, '131016', '0001000', '00012', '12', '1')`); err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		num1, num2 string
		want       LotMatch
	}{
		{"10", "2", 2},
		{"10", "9", 1},
		{"10", "", 2},
		{"12", "", 1},
		{"12", "1", 2},
		{"11", "", 0},
	}
	for _, tt := range tests {
		got, err := repo.ParcelLotMatch(context.Background(), fixtureLgCode, fixtureMachiazaID, tt.num1, tt.num2)
		if err != nil {
			t.Fatalf("ParcelLotMatch(%q, %q) error = %v", tt.num1, tt.num2, err)
		}
		if got != tt.want {
			t.Errorf("ParcelLotMatch(%q, %q) = %d, want %d", tt.num1, tt.num2, got, tt.want)
		}
	}
}

func TestResidentialLotMatch(t *testing.T) {
	repo := newFixtureRepo(t)
	ctx := context.Background()
	// Block 7 has no residential numbers recorded.
	if _, err := repo.db.ExecContext(ctx,
		`INSERT INTO cache_rsdtdsp (pref_code, lg_code, machiaza_id, blk_id, blk_num)
		 VALUES (13, '131016', '0001000', '007', '7')`); err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		num1, num2 string
		want       LotMatch
	}{
		{"1", "2", 2},
		{"1", "9", 1},
		{"1", "", 2},
		{"7", "9", 2},
		{"5", "", 0},
	}
	for _, tt := range tests {
		got, err := repo.ResidentialLotMatch(ctx, fixtureLgCode, fixtureMachiazaID, tt.num1, tt.num2)
		if err != nil {
			t.Fatalf("ResidentialLotMatch(%q, %q) error = %v", tt.num1, tt.num2, err)
		}
		if got != tt.want {
			t.Errorf("ResidentialLotMatch(%q, %q) = %d, want %d", tt.num1, tt.num2, got, tt.want)
		}
	}
}
