# syntax=docker/dockerfile:1

FROM golang:1.26-trixie AS builder

WORKDIR /build

# Copy go mod files first for better caching
COPY common/go.mod ./common/
COPY abrg/go.mod abrg/go.sum ./abrg/
WORKDIR /build/abrg
RUN go mod download

# Copy source code
WORKDIR /build
COPY common/ ./common/
COPY abrg/ ./abrg/
WORKDIR /build/abrg

# Build the application (CGO required for DuckDB)
RUN VERSION=$(cat VERSION) && \
    COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "none") && \
    CGO_ENABLED=1 \
    go build -ldflags="-w -s -X abr.local/common/version.Version=${VERSION} -X abr.local/common/version.Commit=${COMMIT}" -o abrg ./cmd/abrg

# Runtime stage
FROM debian:trixie-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/abrg/abrg /app/abrg

EXPOSE 3000

ENV GIN_MODE=release \
    PORT=3000

ENTRYPOINT ["/app/abrg"]
CMD ["serve"]
