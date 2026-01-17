# Madara Starknet Sequencer Dockerfile
# Builds Madara from source for L3 appchain

FROM rust:1.75-slim as builder

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    pkg-config \
    libssl-dev \
    libclang-dev \
    clang \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Clone Madara repository (use specific stable tag)
ARG MADARA_VERSION=v0.7.0
RUN git clone https://github.com/keep-starknet-strange/madara.git \
    && cd madara \
    && git checkout ${MADARA_VERSION}

# Build Madara
WORKDIR /build/madara
RUN cargo build --release

# Runtime image
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /build/madara/target/release/madara /usr/local/bin/madara

# Create data and secrets directories
RUN mkdir -p /data /secrets /etc/madara

# Copy config file
COPY config.toml /etc/madara/config.toml

# Expose RPC and WebSocket ports
EXPOSE 9944 9945

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:9944/health || exit 1

# Run Madara
ENTRYPOINT ["madara"]
CMD ["--config", "/etc/madara/config.toml"]
