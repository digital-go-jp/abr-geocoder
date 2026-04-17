package normalize

// removeQuotes removes surrounding quotes (single or double) from the string.
func removeQuotes(s string) (string, bool) {
	if len(s) < 2 {
		return s, false
	}

	result := s

	// Remove surrounding double quotes
	if result[0] == '"' && result[len(result)-1] == '"' {
		result = result[1 : len(result)-1]
	}

	// Remove surrounding single quotes (check length again after first removal)
	if len(result) >= 2 && result[0] == '\'' && result[len(result)-1] == '\'' {
		result = result[1 : len(result)-1]
	}

	return result, result != s
}
