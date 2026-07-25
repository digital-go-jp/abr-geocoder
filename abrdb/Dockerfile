# syntax=docker/dockerfile:1

FROM golang:1.26-trixie AS builder

WORKDIR /build

# Copy go mod files first for better caching
COPY common/go.mod ./common/
COPY abrdb/go.mod abrdb/go.sum ./abrdb/
WORKDIR /build/abrdb
RUN go mod download

# Copy source code
WORKDIR /build
COPY common/ ./common/
COPY abrdb/ ./abrdb/
WORKDIR /build/abrdb

# Build the binary (CGO required for DuckDB).
# .dockerignore excludes .git, so the commit hash must come from a build arg:
#   docker build --build-arg COMMIT=$(git rev-parse --short HEAD) ...
ARG COMMIT=none
RUN VERSION=$(cat VERSION) && \
    CGO_ENABLED=1 \
    go build -ldflags="-w -s -X abr.local/common/version.Version=${VERSION} -X abr.local/common/version.Commit=${COMMIT}" -o abrdb ./cmd/abrdb

# Final stage - distroless for minimal image size and security
FROM gcr.io/distroless/cc-debian13:nonroot

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/abrdb/abrdb /app/abrdb

# Set environment variables
ENV ABRDB_DOWNLOAD_DIR=/tmp/abrdb

# CLI tool
ENTRYPOINT ["/app/abrdb"]
CMD ["--help"]
