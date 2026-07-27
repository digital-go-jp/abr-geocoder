// Package char provides shared character classification helpers for address
// processing. It sits below every other internal package and must stay free
// of dependencies.
package char

// IsASCIIDigit reports whether c is an ASCII digit ('0'–'9').
func IsASCIIDigit[T byte | rune](c T) bool {
	return c >= '0' && c <= '9'
}
