# syntax=docker/dockerfile:1

FROM golang:1.27-trixie AS builder

WORKDIR /build

# Copy go mod files first for better caching
COPY go.mod go.sum ./
RUN go mod download

COPY common/ ./common/
COPY abrdb/ ./abrdb/
WORKDIR /build/abrdb

# Build the binary (CGO required for DuckDB).
# .dockerignore excludes .git, so the commit hash must come from a build arg:
#   docker build --build-arg COMMIT=$(git rev-parse --short HEAD) ...
ARG COMMIT=none
RUN VERSION=$(cat VERSION) && \
    CGO_ENABLED=1 \
    go build -ldflags="-w -s -X github.com/digital-go-jp/abr-geocoder/common/version.Version=${VERSION} -X github.com/digital-go-jp/abr-geocoder/common/version.Commit=${COMMIT}" -o abrdb ./cmd/abrdb

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
