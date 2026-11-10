package normalize

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"unicode/utf8"
)

// DefaultMaxAddressLength is the largest number of characters an address may have
// after BasicNormalize, unless EnvMaxAddressLength sets another limit.
const DefaultMaxAddressLength = 100

// EnvMaxAddressLength names the environment variable that sets the address length limit.
const EnvMaxAddressLength = "ABRG_MAX_ADDRESS_LENGTH"

// maxAddressLengthCap bounds EnvMaxAddressLength so that a line at the limit
// stays far below the 64 KiB a CLI input line may have.
const maxAddressLengthCap = 1000

// maxAddressLength is the limit in effect; ConfigureMaxAddressLength sets it at startup.
var maxAddressLength = DefaultMaxAddressLength

var (
	// ErrEmptyAddress reports an address with nothing left after BasicNormalize,
	// such as one holding only whitespace or a comment.
	ErrEmptyAddress = errors.New("address cannot be empty")

	// ErrAddressTooLong reports an address longer than the limit after BasicNormalize.
	ErrAddressTooLong = errors.New("address too long")
)

// ConfigureMaxAddressLength sets the address length limit from EnvMaxAddressLength.
// It leaves the default in place when the variable is unset, and returns an error
// when the value is not an integer from 1 to maxAddressLengthCap.
func ConfigureMaxAddressLength() error {
	v, ok := os.LookupEnv(EnvMaxAddressLength)
	if !ok {
		return nil
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 || n > maxAddressLengthCap {
		return fmt.Errorf("%s=%q: want an integer from 1 to %d", EnvMaxAddressLength, v, maxAddressLengthCap)
	}
	maxAddressLength = n
	return nil
}

// BasicNormalizeInput applies BasicNormalize to an address given as input.
// It returns ErrEmptyAddress or ErrAddressTooLong when the result cannot be matched.
func BasicNormalizeInput(s string) (string, error) {
	s = BasicNormalize(s)
	if s == "" {
		return "", ErrEmptyAddress
	}
	if utf8.RuneCountInString(s) > maxAddressLength {
		return "", fmt.Errorf("%w: max %d characters", ErrAddressTooLong, maxAddressLength)
	}
	return s, nil
}
