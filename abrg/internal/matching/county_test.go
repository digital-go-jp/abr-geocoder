package matching

import "testing"

func TestInsertCounty(t *testing.T) {
	n := &Impl{countyCities: map[string]map[string]string{
		"宮城県": {"涌谷町": "遠田郡"},
		"北海道": {"釧路町": "釧路郡"},
	}}
	tests := []struct {
		addr string
		want string
	}{
		{"宮城県涌谷町字本町", "宮城県遠田郡涌谷町字本町"},
		{"北海道釧路町", "北海道釧路郡釧路町"},
		{"宮城県遠田郡涌谷町", "宮城県遠田郡涌谷町"},
		{"北海道釧路市", "北海道釧路市"},
		{"涌谷町", "涌谷町"},
		{"三重県多気町", "三重県多気町"},
	}

	for _, tt := range tests {
		t.Run(tt.addr, func(t *testing.T) {
			if got := n.insertCounty(tt.addr); got != tt.want {
				t.Errorf("insertCounty(%q) = %q, want %q", tt.addr, got, tt.want)
			}
		})
	}
}
