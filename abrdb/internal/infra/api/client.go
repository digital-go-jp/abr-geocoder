package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Client struct {
	httpClient *http.Client
	feedURL    string
	feedCache  *DCATFeed  // cached feed (nil until first fetch)
	feedMu     sync.Mutex // protects feedCache
}

type FileInfo struct {
	URL          string
	Filename     string
	LastModified time.Time
}

type DCATFeed struct {
	Dataset []Dataset `json:"dataset"`
}

type Dataset struct {
	Description  string         `json:"description"`
	Distribution []Distribution `json:"distribution"`
}

type Distribution struct {
	AccessURL string `json:"accessURL"`
}

func New(feedURL string) *Client {
	// Configure transport to match AWS SDK v2 defaults
	// AWS SDK uses conservative settings that work well with S3/CloudFront
	transport := &http.Transport{
		MaxIdleConns:          100,              // AWS SDK default
		MaxIdleConnsPerHost:   10,               // AWS SDK default - key setting!
		MaxConnsPerHost:       0,                // Unlimited (AWS SDK default)
		IdleConnTimeout:       90 * time.Second, // AWS SDK default
		TLSHandshakeTimeout:   10 * time.Second, // AWS SDK default
		ExpectContinueTimeout: 1 * time.Second,  // AWS SDK default
		DisableCompression:    false,            // AWS SDK enables compression
		ForceAttemptHTTP2:     true,             // Try HTTP/2 like AWS SDK
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second, // AWS SDK default
			KeepAlive: 30 * time.Second, // AWS SDK default
		}).DialContext,
	}

	return &Client{
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   30 * time.Second,
		},
		feedURL: feedURL,
	}
}

// FetchFeed fetches and parses the DCAT feed with caching.
// The feed is cached on success; on error, it retries on the next call.
// Thread-safe: concurrent callers are serialized by feedMu.
func (c *Client) FetchFeed(ctx context.Context) (*DCATFeed, error) {
	c.feedMu.Lock()
	defer c.feedMu.Unlock()

	// Return cached result if available
	if c.feedCache != nil {
		return c.feedCache, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.feedURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch feed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var feed DCATFeed
	if err := json.NewDecoder(resp.Body).Decode(&feed); err != nil {
		return nil, fmt.Errorf("decode feed: %w", err)
	}

	c.feedCache = &feed
	return c.feedCache, nil
}

// ListFilesByPrefix lists files matching the given prefix pattern
func (c *Client) ListFilesByPrefix(ctx context.Context, prefix string) ([]FileInfo, error) {
	feed, err := c.FetchFeed(ctx)
	if err != nil {
		return nil, err
	}

	var files []FileInfo
	for _, dataset := range feed.Dataset {
		for _, dist := range dataset.Distribution {
			// Only process ZIP files
			if !strings.HasSuffix(dist.AccessURL, ".csv.zip") {
				continue
			}

			if !matchesPrefix(dist.AccessURL, prefix) {
				continue
			}

			modified, err := extractModifiedFromDescription(dataset.Description)
			if err != nil {
				// Skip files without valid timestamp in description
				continue
			}

			files = append(files, FileInfo{
				URL:          dist.AccessURL,
				Filename:     filepath.Base(dist.AccessURL),
				LastModified: modified,
			})
		}
	}

	return files, nil
}

// DownloadFile downloads a file from the given URL to the destination path.
// Uses atomic write pattern: downloads to .tmp file first, then renames on success.
func (c *Client) DownloadFile(ctx context.Context, fileURL, destPath string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fileURL, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("download file: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	// Atomic write: download to temp file, rename on success
	tmpPath := destPath + ".tmp"
	if err := downloadToFile(resp.Body, tmpPath); err != nil {
		_ = os.Remove(tmpPath) // Clean up partial file
		return err
	}

	if err := os.Rename(tmpPath, destPath); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("rename temp file: %w", err)
	}

	return nil
}

func downloadToFile(r io.Reader, destPath string) error {
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return fmt.Errorf("create directory: %w", err)
	}

	out, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}

	if _, err := io.Copy(out, r); err != nil {
		_ = out.Close()
		return fmt.Errorf("write file: %w", err)
	}

	if err := out.Close(); err != nil {
		return fmt.Errorf("close file: %w", err)
	}

	return nil
}

// Helper functions

func matchesPrefix(fileURL, prefix string) bool {
	parsedURL, err := url.Parse(fileURL)
	if err != nil {
		return false
	}

	path := strings.Trim(parsedURL.Path, "/")
	normalizedPrefix := strings.Trim(prefix, "/")

	// Must start with prefix and be followed by "/" or end of string.
	// This prevents "mt_pref" from matching "mt_pref_pos".
	return path == normalizedPrefix ||
		strings.HasPrefix(path, normalizedPrefix+"/")
}

func extractModifiedFromDescription(description string) (time.Time, error) {
	// Description format: "最終更新日: 2025-05-28T09:56:52.000Z"
	_, after, found := strings.Cut(description, "最終更新日: ")
	if !found {
		return time.Time{}, fmt.Errorf("timestamp not found in description")
	}

	// Extract timestamp string (everything after the prefix until whitespace)
	fields := strings.Fields(after)
	if len(fields) == 0 {
		return time.Time{}, fmt.Errorf("timestamp not found in description")
	}

	return parseModifiedDate(fields[0])
}

func parseModifiedDate(modifiedStr string) (time.Time, error) {
	// API description format is always: 2025-05-28T09:56:52.000Z
	const format = "2006-01-02T15:04:05.000Z"

	t, err := time.Parse(format, modifiedStr)
	if err != nil {
		return time.Time{}, fmt.Errorf("unable to parse date %q: %w", modifiedStr, err)
	}

	return t, nil
}
