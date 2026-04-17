package model

// NormalizeResponse represents the response for address standardization.
// Type field is restricted to the 4 address types that /normalize can return.
type NormalizeResponse struct {
	Input  string            `json:"input"`
	Output string            `json:"output"`
	Type   NormalizeCategory `json:"type"`
}
