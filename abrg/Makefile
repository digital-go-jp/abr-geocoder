BINARY   := abrg
# Unit tests via gotestsum (hides per-test skip detail; skip count still shown)
TEST_CMD := go tool gotestsum --format-icons text --hide-summary=skipped ./...
EXTRA_CLEAN := rm -rf tmp

include ../Makefile.common

.PHONY: test-issues test-issue1 test-coverage-pkg bench-match help

REGRESSION_PKG := ./internal/matching/issues

# Regression suite against a real DuckDB cache. CACHE_PATH is required; the
# target fails if the cache is missing or any test is skipped, so a green run
# means every regression test actually ran and passed.
#   make test-issues CACHE_PATH=/abs/path/abrg.duckdb
test-issues:
	@test -n "$(CACHE_PATH)" || { echo "ERROR: set CACHE_PATH to a DuckDB cache, e.g. make test-issues CACHE_PATH=/abs/path/abrg.duckdb"; exit 1; }
	@test -f "$(CACHE_PATH)" || { echo "ERROR: cache file not found: $(CACHE_PATH)"; exit 1; }
	@json=$$(mktemp); \
	CACHE_PATH="$(CACHE_PATH)" go tool gotestsum --format testname --jsonfile "$$json" -- -count=1 $(REGRESSION_PKG); \
	code=$$?; \
	grep -Eq '"Action":"skip"[^}]*"Test":"' "$$json" && code=1 && echo "ERROR: regression tests were SKIPPED (incomplete cache: $(CACHE_PATH))"; \
	rm -f "$$json"; \
	exit $$code

# Run a single issue test (usage: make test-issue1 CACHE_PATH=/abs/path/abrg.duckdb)
test-issue1:
	@test -n "$(CACHE_PATH)" || { echo "ERROR: set CACHE_PATH to a DuckDB cache, e.g. make test-issue1 CACHE_PATH=/abs/path/abrg.duckdb"; exit 1; }
	@test -f "$(CACHE_PATH)" || { echo "ERROR: cache file not found: $(CACHE_PATH)"; exit 1; }
	CACHE_PATH="$(CACHE_PATH)" go test -v -count=1 $(REGRESSION_PKG) -run "^TestIssue1$$"

# Run coverage for a specific package (usage: make test-coverage-pkg PKG=./internal/matching)
test-coverage-pkg:
	go test -coverpkg=$(PKG) -coverprofile=coverage.out $(PKG)/...
	go tool cover -html=coverage.out -o coverage.html
	@go tool cover -func=coverage.out | tail -1
	@echo "Coverage report generated: coverage.html"

# Per-record match cost against the bundled Tokyo cache (no PostgreSQL needed).
# Reports the parallelism-independent duration_ms signal; CI compares this
# between base and PR on the same runner. Usage: make bench-match [REPS=3]
bench-match: build
	@bash testdata/bench/run.sh ./$(BINARY) $(or $(REPS),3)

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
	@echo "  test-issues   - Run all issue tests (requires CACHE_PATH=/abs/path.duckdb)"
	@echo "  test-issue1   - Run issue1 test (requires CACHE_PATH=/abs/path.duckdb)"
	@echo "  test-coverage - Run tests with coverage report"
	@echo "  test-coverage-pkg PKG=./path - Run coverage for specific package"
	@echo ""
	@echo "Code Quality:"
	@echo "  lint          - Run lint checks (CI-friendly, no auto-fix)"
	@echo "  fmt           - Auto-format and fix lint issues (incl. go fix)"
	@echo "  vuln          - Run govulncheck"
	@echo "  modernize     - Check go fix modernizations (CI-friendly, no changes)"
	@echo "  bench         - Run benchmarks"
	@echo "  bench-match   - Compare per-record match cost (bundled Tokyo cache)"
	@echo ""
	@echo "Other:"
	@echo "  help          - Show this help"
