# syntax=docker/dockerfile:1

FROM golang:1.26-trixie AS builder

WORKDIR /build

# Copy go mod files first for better caching
COPY common/go.mod ./common/
COPY abrdb/go.mod abrdb/go.sum ./abrdb/
WORKDIR /build/abrdb
RUN go mod download

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

RUN mkdir /empty

# Final stage - distroless for minimal image size and security
FROM gcr.io/distroless/cc-debian13:nonroot

WORKDIR /app

COPY --from=builder /build/abrdb/abrdb /app/abrdb

# A named volume mounts here. Docker initialises an empty one from the image's
# mount point, ownership included, so the directory is created as the nonroot
# user (65532) this runtime image runs as.
COPY --from=builder --chown=65532:65532 /empty /tmp/abrdb/data

ENTRYPOINT ["/app/abrdb"]
CMD ["--help"]
