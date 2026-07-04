BINARY   := abrg
# Unit tests via gotestsum (shows skip summary)
TEST_CMD := go tool gotestsum --format-icons text --hide-summary=skipped ./...
EXTRA_CLEAN := rm -rf tmp

include ../Makefile.common

.PHONY: test-issues test-issue1 test-coverage-pkg prof help

# Run all issue tests with DuckDB cache
test-issues:
	CACHE_PATH=/tmp/test_abrg.duckdb go test -count=1 ./internal/matching/issues | grep -v "==="

# Run issue1 test with DuckDB cache
test-issue1:
	CACHE_PATH=/tmp/test_abrg.duckdb go test -v -count=1 ./internal/matching/issues -run "^TestIssue1$$"

# Run coverage for a specific package (usage: make test-coverage-pkg PKG=./internal/matching)
test-coverage-pkg:
	go test -coverpkg=$(PKG) -coverprofile=coverage.out $(PKG)/...
	go tool cover -html=coverage.out -o coverage.html
	@go tool cover -func=coverage.out | tail -1
	@echo "Coverage report generated: coverage.html"

# Run with profiling
prof:
	@echo "Running with CPU profiling..."
	CPU_PROFILE=cpu.prof go run $(LDFLAGS) ./cmd/abrg/... $(ARGS)
	@echo "View profile with: go tool pprof cpu.prof"

# Show help
help:
	@echo "Available targets:"
	@echo ""
	@echo "Build & Run:"
	@echo "  build         - Build the application"
	@echo "  run           - Run the application"
	@echo "  clean         - Clean build artifacts"
	@echo ""
	@echo "Testing:"
	@echo "  test          - Run all tests"
	@echo "  test-unit     - Run unit tests only"
	@echo "  test-issues   - Run all issue tests with DuckDB cache"
	@echo "  test-issue1   - Run issue1 test with DuckDB cache"
	@echo "  test-integration - Run integration tests"
	@echo "  test-coverage - Run tests with coverage report"
	@echo "  test-coverage-pkg PKG=./path - Run coverage for specific package"
	@echo ""
	@echo "Code Quality:"
	@echo "  lint          - Run lint checks (CI-friendly, no auto-fix)"
	@echo "  fmt           - Auto-format and fix lint issues (incl. go fix)"
	@echo "  vuln          - Run govulncheck"
	@echo "  modernize     - Check go fix modernizations (CI-friendly, no changes)"
	@echo "  bench         - Run benchmarks"
	@echo "  prof          - Run with profiling"
	@echo ""
	@echo "Other:"
	@echo "  help          - Show this help"
