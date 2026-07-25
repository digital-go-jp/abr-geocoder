BINARY := abrdb

include ../Makefile.common

.PHONY: prof help

# Run with profiling
prof:
	@echo "Running with CPU profiling..."
	CPU_PROFILE=cpu.prof go run $(LDFLAGS) ./cmd/abrdb/... import --dry-run
	@echo "View profile with: go tool pprof cpu.prof"

# Show help
help:
	@echo "Available targets:"
	@echo "  build         - Build the application"
	@echo "  test          - Run all tests"
	@echo "  test-coverage - Run tests with coverage report"
	@echo "  lint          - Run lint checks (CI-friendly, no auto-fix)"
	@echo "  fmt           - Auto-format and fix lint issues (incl. go fix)"
	@echo "  vuln          - Run govulncheck"
	@echo "  modernize     - Check go fix modernizations (CI-friendly, no changes)"
	@echo "  bench         - Run benchmarks"
	@echo "  prof          - Run with profiling"
	@echo "  clean         - Clean build artifacts"
	@echo "  help          - Show this help"
