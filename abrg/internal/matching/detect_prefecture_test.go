package matching

import "testing"

func TestDetectPrefectureCode(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		expected string
	}{
		{
			name:     "Hokkaido",
			address:  "北海道札幌市中央区",
			expected: "01",
		},
		{
			name:     "Tokyo",
			address:  "東京都千代田区",
			expected: "13",
		},
		{
			name:     "Osaka",
			address:  "大阪府大阪市",
			expected: "27",
		},
		{
			name:     "Kyoto",
			address:  "京都府京都市",
			expected: "26",
		},
		{
			name:     "Okinawa",
			address:  "沖縄県那覇市",
			expected: "47",
		},
		{
			name:     "Kanagawa",
			address:  "神奈川県横浜市",
			expected: "14",
		},
		{
			name:     "No prefecture",
			address:  "札幌市中央区",
			expected: "",
		},
		{
			name:     "Empty string",
			address:  "",
			expected: "",
		},
		{
			name:     "Prefecture in middle",
			address:  "市北海道札幌",
			expected: "",
		},
		{
			name:     "All prefectures - Aomori",
			address:  "青森県青森市",
			expected: "02",
		},
		{
			name:     "All prefectures - Iwate",
			address:  "岩手県盛岡市",
			expected: "03",
		},
		{
			name:     "All prefectures - Miyagi",
			address:  "宮城県仙台市",
			expected: "04",
		},
		{
			name:     "All prefectures - Fukushima",
			address:  "福島県福島市",
			expected: "07",
		},
		{
			name:     "All prefectures - Saitama",
			address:  "埼玉県さいたま市",
			expected: "11",
		},
		{
			name:     "All prefectures - Chiba",
			address:  "千葉県千葉市",
			expected: "12",
		},
		{
			name:     "All prefectures - Aichi",
			address:  "愛知県名古屋市",
			expected: "23",
		},
		{
			name:     "All prefectures - Hiroshima",
			address:  "広島県広島市",
			expected: "34",
		},
		{
			name:     "All prefectures - Fukuoka",
			address:  "福岡県福岡市",
			expected: "40",
		},
		{
			name:     "All prefectures - Kagoshima",
			address:  "鹿児島県鹿児島市",
			expected: "46",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := detectPrefectureCode(tt.address)
			if result != tt.expected {
				t.Errorf("detectPrefectureCode(%q) = %q, want %q", tt.address, result, tt.expected)
			}
		})
	}
}

func TestPrefectureCount(t *testing.T) {
	// Verify all 47 prefectures are present
	if len(prefecturePrefixes) != 47 {
		t.Errorf("prefecturePrefixes should have 47 entries, got %d", len(prefecturePrefixes))
	}

	// Verify codes are from 01 to 47
	codeCount := make(map[string]int)
	for _, code := range prefecturePrefixes {
		codeCount[code]++
	}

	// Check for duplicate codes
	for code, count := range codeCount {
		if count > 1 {
			t.Errorf("Duplicate prefecture code: %s appears %d times", code, count)
		}
	}

	// Verify specific important prefectures
	expectedPrefectures := map[string]string{
		"北海道":  "01",
		"東京都":  "13",
		"大阪府":  "27",
		"京都府":  "26",
		"沖縄県":  "47",
		"神奈川県": "14",
	}

	for pref, expectedCode := range expectedPrefectures {
		if code, exists := prefecturePrefixes[pref]; !exists {
			t.Errorf("Prefecture %s is missing from prefecturePrefixes", pref)
		} else if code != expectedCode {
			t.Errorf("Prefecture %s has code %s, want %s", pref, code, expectedCode)
		}
	}
}

func TestRemovePrefectureFromAddress(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		prefCode string
		expected string
	}{
		{
			name:     "Tokyo",
			address:  "東京都千代田区紀尾井町",
			prefCode: "13",
			expected: "千代田区紀尾井町",
		},
		{
			name:     "Hokkaido",
			address:  "北海道札幌市中央区",
			prefCode: "01",
			expected: "札幌市中央区",
		},
		{
			name:     "Osaka",
			address:  "大阪府大阪市北区",
			prefCode: "27",
			expected: "大阪市北区",
		},
		{
			name:     "With leading space",
			address:  "東京都 千代田区",
			prefCode: "13",
			expected: "千代田区",
		},
		{
			name:     "Invalid pref code",
			address:  "東京都千代田区",
			prefCode: "99",
			expected: "東京都千代田区",
		},
		{
			name:     "Empty pref code",
			address:  "東京都千代田区",
			prefCode: "",
			expected: "東京都千代田区",
		},
		{
			name:     "Mismatched prefecture",
			address:  "東京都千代田区",
			prefCode: "27",
			expected: "東京都千代田区",
		},
		{
			name:     "Prefecture only",
			address:  "東京都",
			prefCode: "13",
			expected: "東京都",
		},
		{
			name:     "Empty address",
			address:  "",
			prefCode: "13",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := removePrefectureFromAddress(tt.address, tt.prefCode)
			if result != tt.expected {
				t.Errorf("removePrefectureFromAddress(%q, %q) = %q, want %q",
					tt.address, tt.prefCode, result, tt.expected)
			}
		})
	}
}
