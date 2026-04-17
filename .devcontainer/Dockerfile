FROM golang:1.26-trixie

WORKDIR /workspace

# System packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata \
    locales \
    git \
    jq \
    curl \
    wget \
    unzip \
    bash-completion \
    postgresql-client \
    gh \
    && rm -rf /var/lib/apt/lists/*

# Locale and timezone
RUN ln -sf /usr/share/zoneinfo/Asia/Tokyo /etc/localtime \
    && echo "Asia/Tokyo" > /etc/timezone \
    && sed -i -E 's/# (ja_JP.UTF-8)/\1/' /etc/locale.gen \
    && locale-gen
ENV LANG=ja_JP.UTF-8

# DuckDB CLI
RUN curl -fsSL https://install.duckdb.org | sh \
    && mv /root/.duckdb /usr/local/duckdb \
    && DUCKDB_VERSION=$(basename $(readlink /usr/local/duckdb/cli/latest)) \
    && rm /usr/local/duckdb/cli/latest \
    && ln -s /usr/local/duckdb/cli/$DUCKDB_VERSION /usr/local/duckdb/cli/latest
ENV PATH="/usr/local/duckdb/cli/latest:${PATH}"

# Terraform
RUN ARCH=$(uname -m) \
    && case "$ARCH" in x86_64) TF_ARCH=amd64;; aarch64) TF_ARCH=arm64;; *) exit 1;; esac \
    && curl -fsSL "https://releases.hashicorp.com/terraform/1.10.5/terraform_1.10.5_linux_${TF_ARCH}.zip" -o /tmp/terraform.zip \
    && unzip -q /tmp/terraform.zip -d /usr/local/bin \
    && rm /tmp/terraform.zip

# AWS CLI v2
RUN ARCH=$(uname -m) \
    && case "$ARCH" in x86_64) AWS_ARCH=x86_64;; aarch64) AWS_ARCH=aarch64;; *) exit 1;; esac \
    && curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_ARCH}.zip" -o /tmp/awscliv2.zip \
    && unzip -q /tmp/awscliv2.zip -d /tmp \
    && /tmp/aws/install \
    && rm -rf /tmp/awscliv2.zip /tmp/aws

# Go tools
RUN go install golang.org/x/tools/cmd/goimports@latest \
    && go install golang.org/x/tools/gopls@latest \
    && go install honnef.co/go/tools/cmd/staticcheck@latest \
    && go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest \
    && go install golang.org/x/vuln/cmd/govulncheck@latest \
    && go install github.com/google/go-licenses@latest
