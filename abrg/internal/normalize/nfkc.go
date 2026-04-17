package normalize

import "golang.org/x/text/unicode/norm"

// NFKCNormalize performs Unicode NFKC normalization only if needed.
func NFKCNormalize(s string) (string, bool) {
	if norm.NFKC.IsNormalString(s) {
		return s, false
	}
	normalized := norm.NFKC.String(s)
	return normalized, true
}
