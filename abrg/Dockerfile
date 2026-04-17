# Multi-stage build for production
# Build from repository root: docker build -f abrg/Dockerfile .
#
# Targets:
#   base  - 標準版（デフォルト）
#   aws   - AWS ECS用（AWS CLI付き）
#
# Examples:
#   docker build -f abrg/Dockerfile .                  # 標準版
#   docker build -f abrg/Dockerfile --target aws .     # AWS ECS用
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

# 標準版
FROM debian:trixie-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/abrg/abrg /app/abrg

EXPOSE 3000

ENV GIN_MODE=release \
    PORT=3000

ENTRYPOINT ["/app/abrg"]
CMD ["server"]

# AWS ECS用（AWS CLI付き）
FROM base AS aws

RUN apt-get update && apt-get install -y --no-install-recommends \
    gzip \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "amd64" ]; then AWS_ARCH="x86_64"; \
    elif [ "$ARCH" = "arm64" ]; then AWS_ARCH="aarch64"; \
    else echo "Unsupported architecture: $ARCH" && exit 1; fi && \
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_ARCH}.zip" -o /tmp/awscliv2.zip && \
    unzip -q /tmp/awscliv2.zip -d /tmp && \
    /tmp/aws/install && \
    rm -rf /tmp/awscliv2.zip /tmp/aws
