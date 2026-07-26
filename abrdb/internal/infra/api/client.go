package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"math/rand/v2"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Client struct {
	httpClient  *http.Client
	feedURL     string
	feedCache   *DCATFeed  // cached feed (nil until first fetch)
	feedMu      sync.Mutex // protects feedCache
	feedTimeout time.Duration
	retry       retryPolicy
	sleep       func(ctx context.Context, d time.Duration) error // injectable for tests
	jitter      func(d time.Duration) time.Duration              // injectable for tests
}

// retryPolicy bounds the retries of a failed HTTP attempt.
type retryPolicy struct {
	maxRetries int           // retries after the first attempt
	baseDelay  time.Duration // backoff before the first retry, doubled each retry
	maxDelay   time.Duration // cap for both backoff and server-requested Retry-After
}

// httpStatusError reports a non-200 response, carrying the server-requested
// retry delay when one was sent.
type httpStatusError struct {
	status     int
	retryAfter time.Duration // 0 when absent or unparsable
}

func (e *httpStatusError) Error() string {
	return fmt.Sprintf("unexpected status code: %d", e.status)
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
		Proxy:                 http.ProxyFromEnvironment, // honor HTTP_PROXY/HTTPS_PROXY/NO_PROXY
		MaxIdleConns:          100,                       // AWS SDK default
		MaxIdleConnsPerHost:   10,                        // AWS SDK default - key setting!
		MaxConnsPerHost:       0,                         // Unlimited (AWS SDK default)
		IdleConnTimeout:       90 * time.Second,          // AWS SDK default
		TLSHandshakeTimeout:   10 * time.Second,          // AWS SDK default
		ExpectContinueTimeout: 1 * time.Second,           // AWS SDK default
		DisableCompression:    false,                     // AWS SDK enables compression
		ForceAttemptHTTP2:     true,                      // Try HTTP/2 like AWS SDK
		ResponseHeaderTimeout: 30 * time.Second,          // Limits header recv only; body transfer is unbounded
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second, // AWS SDK default
			KeepAlive: 30 * time.Second, // AWS SDK default
		}).DialContext,
	}

	return &Client{
		httpClient: &http.Client{
			Transport: transport,
		},
		feedURL:     feedURL,
		feedTimeout: 30 * time.Second,
		retry: retryPolicy{
			maxRetries: 3,
			baseDelay:  1 * time.Second,
			maxDelay:   30 * time.Second,
		},
		sleep:  sleepContext,
		jitter: defaultJitter,
	}
}

// doWithRetry runs attempt with bounded exponential backoff. One attempt is
// self-contained (request, status check, body consumption, temp cleanup), so
// a retry always starts from a clean slate. Connection errors, mid-body
// failures, 5xx, 429 and 408 are retried; other 4xx fail immediately. The
// backoff wait aborts as soon as ctx is done.
func (c *Client) doWithRetry(ctx context.Context, attempt func() error) error {
	for try := 0; ; try++ {
		err := attempt()
		if err == nil {
			return nil
		}
		if try >= c.retry.maxRetries || !isRetryable(err) || ctx.Err() != nil {
			return err
		}
		delay := c.retryDelay(try, err)
		slog.Warn("retrying request", "event", "http_retry",
			"attempt", try+1, "max_retries", c.retry.maxRetries, "delay", delay, "error", err)
		if c.sleep(ctx, delay) != nil {
			return err
		}
	}
}

// isRetryable classifies an attempt failure. HTTP statuses follow the given
// policy; every non-status error (dial failure, reset, truncated body) is
// considered transient except context cancellation.
func isRetryable(err error) bool {
	if se, ok := errors.AsType[*httpStatusError](err); ok {
		return se.status >= 500 ||
			se.status == http.StatusTooManyRequests ||
			se.status == http.StatusRequestTimeout
	}
	return !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded)
}

// retryDelay picks the wait before retry number try+1: the server-requested
// Retry-After when present, otherwise jittered exponential backoff. Both are
// capped at maxDelay so a hostile or misconfigured server cannot stall the
// import.
func (c *Client) retryDelay(try int, err error) time.Duration {
	if se, ok := errors.AsType[*httpStatusError](err); ok && se.retryAfter > 0 {
		return min(se.retryAfter, c.retry.maxDelay)
	}
	return c.jitter(min(c.retry.baseDelay<<try, c.retry.maxDelay))
}

// parseRetryAfter accepts both Retry-After forms (delay-seconds and
// HTTP-date). Absent, unparsable or non-positive values yield 0, which falls
// back to the computed backoff.
func parseRetryAfter(header string) time.Duration {
	header = strings.TrimSpace(header)
	if header == "" {
		return 0
	}
	if secs, err := strconv.Atoi(header); err == nil {
		return max(time.Duration(secs)*time.Second, 0)
	}
	if t, err := http.ParseTime(header); err == nil {
		return max(time.Until(t), 0)
	}
	return 0
}

// sleepContext waits for d, aborting as soon as ctx is done.
func sleepContext(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// defaultJitter spreads the delay over [d/2, d) so concurrent downloads do
// not retry in lockstep.
func defaultJitter(d time.Duration) time.Duration {
	if d <= 1 {
		return d
	}
	half := d / 2
	return half + rand.N(half)
}

func statusError(resp *http.Response) error {
	return &httpStatusError{
		status:     resp.StatusCode,
		retryAfter: parseRetryAfter(resp.Header.Get("Retry-After")),
	}
}

// FetchFeed fetches and parses the DCAT feed with caching.
// The feed is cached on success; on error, it retries on the next call.
// Thread-safe: concurrent callers are serialized by feedMu.
// Feed fetches are limited to feedTimeout (30 seconds; small JSON, should be
// fast) — the limit spans all retry attempts including their backoff waits.
func (c *Client) FetchFeed(ctx context.Context) (*DCATFeed, error) {
	c.feedMu.Lock()
	defer c.feedMu.Unlock()

	// Return cached result if available
	if c.feedCache != nil {
		return c.feedCache, nil
	}

	fetchCtx, cancel := context.WithTimeout(ctx, c.feedTimeout)
	defer cancel()

	var feed DCATFeed
	if err := c.doWithRetry(fetchCtx, func() error {
		return c.fetchFeedOnce(fetchCtx, &feed)
	}); err != nil {
		return nil, err
	}

	c.feedCache = &feed
	return c.feedCache, nil
}

// fetchFeedOnce performs one complete feed attempt: request, status check,
// body decode into out.
func (c *Client) fetchFeedOnce(ctx context.Context, out *DCATFeed) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.feedURL, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("fetch feed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return statusError(resp)
	}

	var feed DCATFeed
	if err := json.NewDecoder(resp.Body).Decode(&feed); err != nil {
		return fmt.Errorf("decode feed: %w", err)
	}
	*out = feed
	return nil
}

// ListFilesByPrefix lists files matching the given prefix pattern
func (c *Client) ListFilesByPrefix(ctx context.Context, prefix string) ([]FileInfo, error) {
	feed, err := c.FetchFeed(ctx)
	if err != nil {
		return nil, err
	}

	var files []FileInfo
	var parseFailures int
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
				// A single bad description is skipped with a warning; if every
				// matching file fails, the feed format has likely changed and
				// silently reporting "no changes" would freeze data updates.
				slog.Warn("skipping file with unparsable last-modified",
					"event", "dcat_parse", "url", dist.AccessURL, "error", err)
				parseFailures++
				continue
			}

			files = append(files, FileInfo{
				URL:          dist.AccessURL,
				Filename:     filepath.Base(dist.AccessURL),
				LastModified: modified,
			})
		}
	}

	if len(files) == 0 && parseFailures > 0 {
		return nil, fmt.Errorf("no parsable last-modified date in %d matching files for prefix %q: DCAT feed format may have changed", parseFailures, prefix)
	}

	return files, nil
}

// DownloadFile downloads a file from the given URL to the destination path.
// Uses atomic write pattern: downloads to .tmp file first, then renames on success.
// Transient failures — including a connection dropped mid-body — are retried
// with backoff; each retry restarts the download from scratch.
func (c *Client) DownloadFile(ctx context.Context, fileURL, destPath string) error {
	if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
		return fmt.Errorf("create directory: %w", err)
	}

	return c.doWithRetry(ctx, func() error {
		return c.downloadOnce(ctx, fileURL, destPath)
	})
}

// downloadOnce performs one complete download attempt: request, status check,
// body copy to a temp file, atomic rename. Partial temp files are removed
// before returning, so a retry starts clean.
func (c *Client) downloadOnce(ctx context.Context, fileURL, destPath string) error {
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
		return statusError(resp)
	}

	// Atomic write: download to a uniquely named temp file, rename on success.
	// The unique name keeps concurrent processes from clobbering each other's
	// partial downloads.
	tmp, err := createUniqueTemp(destPath)
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	tmpPath := tmp.Name()

	if err := writeAndClose(tmp, resp.Body); err != nil {
		_ = os.Remove(tmpPath) // Clean up partial file
		return err
	}

	if err := os.Rename(tmpPath, destPath); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("rename temp file: %w", err)
	}

	return nil
}

// createUniqueTemp exclusively creates a temp file next to destPath with the
// same 0666-minus-umask permissions that os.Create would give the final file.
func createUniqueTemp(destPath string) (*os.File, error) {
	for range 10 {
		p := fmt.Sprintf("%s.%d.tmp", destPath, rand.Uint64())
		f, err := os.OpenFile(p, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o666)
		if errors.Is(err, fs.ErrExist) {
			continue
		}
		return f, err
	}
	return nil, errors.New("could not find a free temp file name")
}

// writeAndClose copies r into out and closes it.
func writeAndClose(out *os.File, r io.Reader) error {
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
		return time.Time{}, errors.New("timestamp not found in description")
	}

	// Extract timestamp string (everything after the prefix until whitespace)
	fields := strings.Fields(after)
	if len(fields) == 0 {
		return time.Time{}, errors.New("timestamp not found in description")
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
