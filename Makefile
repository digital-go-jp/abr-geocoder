.PHONY: help build test lint clean abrg-build abrg-test abrg-lint abrdb-build abrdb-test abrdb-lint all

# Default target
help:
	@echo "Available targets:"
	@echo ""
	@echo "All projects:"
	@echo "  all           - Build all projects"
	@echo "  build         - Build all projects"
	@echo "  test          - Run tests for all projects"
	@echo "  lint          - Run lint for all projects"
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

test: abrg-test abrdb-test

lint: abrg-lint abrdb-lint

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
	@cd abrg && make run ARGS="server"

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

abrdb-clean:
	@echo "Cleaning abrdb..."
	@cd abrdb && make clean
