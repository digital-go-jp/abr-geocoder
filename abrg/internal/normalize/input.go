package normalize

import (
	"errors"
	"fmt"
	"unicode/utf8"
)

// MaxAddressLength is the largest number of characters an address may have after BasicNormalize.
const MaxAddressLength = 100

var (
	// ErrEmptyAddress reports an address with nothing left after BasicNormalize,
	// such as one holding only whitespace or a comment.
	ErrEmptyAddress = errors.New("address cannot be empty")

	// ErrAddressTooLong reports an address longer than MaxAddressLength after BasicNormalize.
	ErrAddressTooLong = fmt.Errorf("address too long: max %d characters", MaxAddressLength)
)

// BasicNormalizeInput applies BasicNormalize to an address given as input.
// It returns ErrEmptyAddress or ErrAddressTooLong when the result cannot be matched.
func BasicNormalizeInput(s string) (string, error) {
	s = BasicNormalize(s)
	if s == "" {
		return "", ErrEmptyAddress
	}
	if utf8.RuneCountInString(s) > MaxAddressLength {
		return "", ErrAddressTooLong
	}
	return s, nil
}
