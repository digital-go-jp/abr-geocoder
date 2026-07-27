.PHONY: help build test lint fmt vuln modernize clean abrg-build abrg-test abrg-lint abrg-fmt abrg-vuln abrg-modernize abrdb-build abrdb-test abrdb-lint abrdb-fmt abrdb-vuln abrdb-modernize common-test common-lint common-vuln common-modernize all

# Default target
help:
	@echo "Available targets:"
	@echo ""
	@echo "All projects:"
	@echo "  all           - Build all projects"
	@echo "  build         - Build all projects"
	@echo "  test          - Run tests for all projects"
	@echo "  lint          - Run lint for all projects"
	@echo "  modernize     - Check go fix modernizations for all projects"
	@echo "  clean         - Clean all projects"
	@echo ""
	@echo "ABRG (Geocoding API):"
	@echo "  abrg-build    - Build abrg"
	@echo "  abrg-test     - Run abrg tests"
	@echo "  abrg-lint     - Run abrg lint"
	@echo "  abrg-run      - Run abrg server"
	@echo ""
	@echo "ABRDB (Database sync):"
	@echo "  abrdb-build   - Build abrdb"
	@echo "  abrdb-test    - Run abrdb tests"
	@echo "  abrdb-lint    - Run abrdb lint"
	@echo ""

# All projects
all: build

build: abrg-build abrdb-build

test: abrg-test abrdb-test common-test

lint: abrg-lint abrdb-lint common-lint

fmt: abrg-fmt abrdb-fmt

vuln: abrg-vuln abrdb-vuln common-vuln

modernize: abrg-modernize abrdb-modernize common-modernize

clean: abrg-clean abrdb-clean

# ABRG targets
abrg-build:
	@echo "Building abrg..."
	@cd abrg && make build

abrg-test:
	@echo "Testing abrg..."
	@cd abrg && make test

abrg-lint:
	@echo "Linting abrg..."
	@cd abrg && make lint

abrg-run:
	@echo "Running abrg server..."
	@cd abrg && make run ARGS="serve"

abrg-fmt:
	@cd abrg && make fmt

abrg-vuln:
	@cd abrg && make vuln

abrg-modernize:
	@echo "Modernize check abrg..."
	@cd abrg && make modernize

abrg-clean:
	@echo "Cleaning abrg..."
	@cd abrg && make clean

# ABRDB targets
abrdb-build:
	@echo "Building abrdb..."
	@cd abrdb && make build

abrdb-test:
	@echo "Testing abrdb..."
	@cd abrdb && make test

abrdb-lint:
	@echo "Linting abrdb..."
	@cd abrdb && make lint

abrdb-fmt:
	@cd abrdb && make fmt

abrdb-vuln:
	@cd abrdb && make vuln

abrdb-modernize:
	@echo "Modernize check abrdb..."
	@cd abrdb && make modernize

abrdb-clean:
	@echo "Cleaning abrdb..."
	@cd abrdb && make clean

# Common module targets
common-test:
	@echo "Testing common..."
	@cd common && make test

common-lint:
	@echo "Linting common..."
	@cd common && make lint

common-vuln:
	@cd common && make vuln

common-modernize:
	@echo "Modernize check common..."
	@cd common && make modernize
