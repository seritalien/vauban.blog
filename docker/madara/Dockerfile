# Madara Starknet Sequencer Dockerfile
# Builds Madara from source for L3 appchain

FROM rust:1.82-slim AS builder

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    pkg-config \
    libssl-dev \
    libclang-dev \
    clang \
    curl \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Install Scarb (Cairo package manager) - required for devnet contracts
RUN curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | bash -s -- -v 2.8.2
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /build

# Clone new Madara repository (madara-alliance)
ARG MADARA_VERSION=main
RUN git clone https://github.com/madara-alliance/madara.git \
    && cd madara \
    && git checkout ${MADARA_VERSION}

# Build Madara
WORKDIR /build/madara
RUN cargo build --bin madara --release

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

# Copy config file and entrypoint script
COPY config.toml /etc/madara/config.toml
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose RPC and WebSocket ports
EXPOSE 9944 9945

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD curl -f http://localhost:9944/health || exit 1

# Run Madara via entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["--name", "Vauban", "--devnet", "--base-path", "/data", "--rpc-port", "9944", "--rpc-external", "--rpc-cors", "all"]
