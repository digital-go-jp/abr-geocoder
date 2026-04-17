# Version from VERSION file
VERSION := $(shell cat VERSION)
COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")

# Build variables
LDFLAGS := -ldflags "-X abr.local/common/version.Version=$(VERSION) -X abr.local/common/version.Commit=$(COMMIT)"

.PHONY: test test-unit test-integration test-coverage test-coverage-pkg test-issues test-issue1 build run clean lint bench prof help

# Run all tests
test: test-unit

# Run unit tests only (shows skip summary via gotestsum)
test-unit:
	@go tool gotestsum --format-icons text --hide-summary=skipped ./...

# Run all issue tests with DuckDB cache
test-issues:
	CACHE_PATH=/tmp/test_abrg.duckdb go test -count=1 ./internal/matching/issues | grep -v "==="

# Run issue1 test with DuckDB cache
test-issue1:
	CACHE_PATH=/tmp/test_abrg.duckdb go test -v -count=1 ./internal/matching/issues -run "^TestIssue1$$"

# Run integration tests
test-integration:
	go test -tags=integration -v ./...

# Run tests with coverage (uses -coverpkg for accurate cross-package measurement)
test-coverage:
	go test -coverpkg=./... -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@go tool cover -func=coverage.out | tail -1
	@echo "Coverage report generated: coverage.html"

# Run coverage for a specific package (usage: make test-coverage-pkg PKG=./internal/matching)
test-coverage-pkg:
	go test -coverpkg=$(PKG) -coverprofile=coverage.out $(PKG)/...
	go tool cover -html=coverage.out -o coverage.html
	@go tool cover -func=coverage.out | tail -1
	@echo "Coverage report generated: coverage.html"

# Build the application
build:
	go build $(LDFLAGS) -o ./abrg ./cmd/abrg

# Run the application
run:
	go run $(LDFLAGS) ./cmd/abrg/... $(ARGS)

# Clean build artifacts
clean:
	rm -f /tmp/abrg coverage.out coverage.html
	rm -rf tmp

# Run lint tools (auto-fix)
lint:
	@echo "Running go mod tidy..."
	@go mod tidy
	@echo "Running go mod verify..."
	@go mod verify
	@echo "Running goimports..."
	@goimports -w .
	@echo "Running go vet..."
	@go vet ./...
	@echo "Running golangci-lint..."
	@golangci-lint run --fix --enable unused --enable ineffassign --enable staticcheck --enable errcheck
	@echo "Checking for security vulnerabilities..."
	@go run golang.org/x/vuln/cmd/govulncheck@latest ./...
	@echo "Lint checks completed!"


# Run benchmarks
bench:
	@echo "Running benchmarks..."
	go test -bench=. -benchmem ./...

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
	@echo "  lint          - Run linter and code checks"
	@echo "  bench         - Run benchmarks"
	@echo "  prof          - Run with profiling"
	@echo ""
	@echo "Other:"
	@echo "  help          - Show this help"
