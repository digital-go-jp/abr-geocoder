# Version from VERSION file
VERSION := $(shell cat VERSION)
COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")

# Build variables
LDFLAGS := -ldflags "-X abr.local/common/version.Version=$(VERSION) -X abr.local/common/version.Commit=$(COMMIT)"

.PHONY: test test-unit test-integration test-coverage build run clean lint fmt vuln bench prof help

# Run all tests
test: test-unit

# Run unit tests only
test-unit:
	go test ./...

# Run integration tests
test-integration:
	go test -tags=integration -v ./...

# Run tests with coverage
test-coverage:
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

	@echo "Coverage report generated: coverage.html"

# Build the application
build:
	go build $(LDFLAGS) -o ./abrdb ./cmd/abrdb

# Run the application
run:
	go run $(LDFLAGS) ./cmd/abrdb/... $(ARGS)

# Clean build artifacts
clean:
	rm -f /tmp/abrdb coverage.out coverage.html

# Run lint checks without modifying files (CI-friendly)
lint:
	go mod verify
	go vet ./...
	golangci-lint run

# Run lint tools with auto-fix (local dev)
fmt:
	go mod tidy
	goimports -w .
	golangci-lint run --fix

# Security vulnerability scan
vuln:
	go run golang.org/x/vuln/cmd/govulncheck@latest ./...


# Run benchmarks
bench:
	@echo "Running benchmarks..."
	go test -bench=. -benchmem ./...

# Run with profiling
prof:
	@echo "Running with CPU profiling..."
	CPU_PROFILE=cpu.prof go run $(LDFLAGS) ./cmd/abrdb/... sync --check
	@echo "View profile with: go tool pprof cpu.prof"

# Show help
help:
	@echo "Available targets:"
	@echo "  build         - Build the application"
	@echo "  test          - Run all tests"
	@echo "  test-coverage - Run tests with coverage report"
	@echo "  lint          - Run lint checks (CI-friendly, no auto-fix)"
	@echo "  fmt           - Auto-format and fix lint issues"
	@echo "  vuln          - Run govulncheck"
	@echo "  bench         - Run benchmarks"
	@echo "  prof          - Run with profiling"
	@echo "  clean         - Clean build artifacts"
	@echo "  help          - Show this help"
