# Vauban Blog - Madara L3 Devnet Setup

Production-ready Docker Compose environment for running a Starknet L3 Appchain with Madara sequencer, including IPFS caching and Redis session storage.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VAUBAN BLOG L3 STACK                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌─────────────┐    ┌──────────────┐ │
│  │    Madara    │◄──►│    Redis    │    │     IPFS     │ │
│  │ L3 Sequencer │    │   Cache &   │    │ Content Node │ │
│  │              │    │   Sessions  │    │              │ │
│  │  Port: 9944  │    │ Port: 6379  │    │ Port: 8080   │ │
│  └──────┬───────┘    └─────────────┘    └──────────────┘ │
│         │                                                  │
│         │ Auto-Settlement                                  │
│         │ every 100 blocks                                 │
│         ▼                                                  │
│  ┌──────────────────────────────┐                         │
│  │  Starknet Sepolia L2 (RPC)   │                         │
│  │  https://sepolia.starknet.io │                         │
│  └──────────────────────────────┘                         │
│                                                             │
│  Optional Monitoring:                                       │
│  ┌──────────────┐    ┌─────────────┐                      │
│  │  Prometheus  │◄───│   Grafana   │                      │
│  │ Port: 9090   │    │ Port: 3001  │                      │
│  └──────────────┘    └─────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Docker Engine 24.0+
- Docker Compose 2.20+
- 4GB RAM minimum (8GB recommended)
- 10GB disk space for blockchain data

## Quick Start

### 1. Setup Secrets (for Auto-Settlement)

If you want to enable auto-settlement to Sepolia L2:

```bash
# Create secrets directory
mkdir -p docker/secrets

# Add your Sepolia private key
echo "0xYOUR_SEPOLIA_PRIVATE_KEY" > docker/secrets/sepolia_private_key.txt
chmod 600 docker/secrets/sepolia_private_key.txt
```

**Important**: This private key should have STRK tokens on Sepolia to pay for settlement gas fees.

### 2. Configure Madara

Edit `docker/madara/config.toml`:

```toml
[settlement]
enabled = true
starknet_rpc = "https://starknet-sepolia.infura.io/v3/YOUR_INFURA_KEY"
settlement_account_address = "0xYOUR_SEPOLIA_ADDRESS"  # Address matching private key
```

To disable auto-settlement for local testing:

```toml
[settlement]
enabled = false
```

### 3. Start the Devnet

```bash
# Basic start (Madara + Redis + IPFS)
./scripts/start-devnet.sh

# With monitoring (adds Prometheus + Grafana)
./scripts/start-devnet.sh --monitoring
```

### 4. Deploy Contracts

```bash
# Compile contracts first
cd contracts
scarb build

# Deploy to Madara L3
./contracts/scripts/deploy.sh
```

The deployment script will:
- Deploy all four contracts (BlogRegistry, Social, Paymaster, SessionKeyManager)
- Configure Paymaster whitelist
- Save addresses to `.deployments.json`
- Generate `apps/frontend/.env.local` with contract addresses

## Service URLs

Once started, services are available at:

| Service | URL | Purpose |
|---------|-----|---------|
| Madara RPC | http://localhost:9944 | Starknet L3 JSON-RPC |
| Madara WebSocket | ws://localhost:9945 | Real-time events |
| Redis | redis://localhost:6379 | Cache & sessions |
| IPFS Gateway | http://localhost:8080 | Content retrieval |
| IPFS API | http://localhost:5001 | Upload & pin |
| Prometheus* | http://localhost:9090 | Metrics |
| Grafana* | http://localhost:3001 | Dashboards (admin/admin) |

\* Only available with `--monitoring` flag

## Madara Configuration

### Block Production

```toml
[blocks]
block_time_ms = 6000  # 6 seconds per block
max_transactions_per_block = 100
```

### Auto-Settlement

Settlement happens automatically every 100 L3 blocks (~10 minutes):

```toml
[settlement]
enabled = true
settlement_interval_blocks = 100
max_retries = 3
retry_delay_seconds = 30
```

### Development Mode

```toml
[dev]
instant_finality = true  # No confirmation blocks
prefunded_accounts = [
    {address = "0x...", balance = "1000000000000000000000"},
]
```

## Management Commands

### View Logs

```bash
# Madara logs
docker logs -f vauban-madara-l3

# All services
docker-compose logs -f

# Specific service
docker logs -f vauban-redis
docker logs -f vauban-ipfs
```

### Stop Devnet

```bash
cd docker
docker-compose down

# Stop and remove volumes (full reset)
docker-compose down -v
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart madara
```

### Access IPFS

```bash
# Upload content
curl -X POST -F file=@article.json http://localhost:5001/api/v0/add

# Retrieve content
curl http://localhost:8080/ipfs/QmXXXXX...

# Check node info
curl http://localhost:5001/api/v0/id
```

### Redis Operations

```bash
# Connect to Redis CLI
docker exec -it vauban-redis redis-cli

# Check session keys
docker exec vauban-redis redis-cli KEYS "session:*"

# Monitor commands
docker exec vauban-redis redis-cli MONITOR
```

## Troubleshooting

### Madara Won't Start

**Symptom**: Madara exits immediately after start

**Check logs**:
```bash
docker logs vauban-madara-l3
```

**Common issues**:
1. **Invalid config**: Check `docker/madara/config.toml` syntax
2. **Missing secrets**: Settlement enabled but no private key
3. **Port conflict**: Port 9944 already in use
4. **Insufficient resources**: Madara needs 2GB+ RAM

**Fix**:
```bash
# Disable settlement temporarily
# In docker/madara/config.toml:
[settlement]
enabled = false

# Restart
docker-compose restart madara
```

### Settlement Failures

**Symptom**: Logs show "Settlement failed" errors

**Possible causes**:
1. **Insufficient STRK**: Settlement account has no funds on Sepolia
2. **Invalid RPC**: Infura key expired or rate-limited
3. **Network issues**: Cannot reach Sepolia RPC

**Check settlement balance**:
```bash
# Use Starkli to check balance on Sepolia
starkli balance 0xYOUR_ADDRESS --rpc https://starknet-sepolia.infura.io/v3/KEY
```

**Fix**:
- Fund account: Get STRK from [Sepolia faucet](https://faucet.goerli.starknet.io/)
- Update RPC: Use alternative endpoint in config.toml
- Increase retries: Adjust `max_retries` and `retry_delay_seconds`

### IPFS Content Not Found

**Symptom**: HTTP 404 when fetching content via gateway

**Possible causes**:
1. Content not pinned
2. IPFS node disconnected from network
3. CID incorrect

**Fix**:
```bash
# Check if content is local
docker exec vauban-ipfs ipfs pin ls | grep QmXXXX

# Re-pin content
docker exec vauban-ipfs ipfs pin add QmXXXX

# Check IPFS connectivity
docker exec vauban-ipfs ipfs swarm peers | wc -l  # Should show peers
```

### Redis Connection Refused

**Symptom**: Frontend can't connect to Redis

**Check**:
```bash
# Test connection
docker exec vauban-redis redis-cli ping  # Should return PONG

# Check if port is exposed
netstat -tuln | grep 6379
```

**Fix**:
```bash
docker-compose restart redis
```

### Contract Deployment Fails

**Symptom**: `deploy.sh` exits with error

**Common issues**:
1. **No account**: Starkli account not configured
2. **Insufficient funds**: Deployer account has no ETH/STRK
3. **Madara not ready**: RPC not responding yet

**Fix**:
```bash
# Create Starkli account
starkli account oz init ~/.starknet_accounts/deployer.json

# Check Madara is ready
curl http://localhost:9944/health

# Wait 30s after devnet start before deploying
sleep 30 && ./contracts/scripts/deploy.sh
```

## Performance Tuning

### Madara

```toml
[database]
cache_size_mb = 512  # Increase for better performance

[blocks]
block_time_ms = 3000  # Faster blocks (3s instead of 6s)
```

### Redis

```yaml
# In docker-compose.yml under redis service
command: >
  redis-server
  --maxmemory 512mb  # Increase cache size
  --maxmemory-policy allkeys-lru
```

### IPFS

```yaml
environment:
  IPFS_FD_MAX: 8192  # More file descriptors
```

## Monitoring

Enable monitoring with Prometheus + Grafana:

```bash
./scripts/start-devnet.sh --monitoring
```

### Grafana Dashboards

Access at http://localhost:3001 (admin/admin)

Pre-configured dashboards:
- **Madara Overview**: Block production, TX throughput, latency
- **Redis Metrics**: Memory usage, commands/sec, hit rate
- **IPFS Stats**: Peer count, bandwidth, pinned content

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `madara_block_height` | Current L3 block | - |
| `madara_settlement_lag` | Blocks since last settlement | > 150 |
| `redis_memory_used_bytes` | Redis memory | > 256MB |
| `ipfs_peer_count` | Connected IPFS peers | < 5 |

## Data Persistence

All data is stored in Docker volumes:

```bash
# List volumes
docker volume ls | grep vauban

# Backup Madara data
docker run --rm -v vauban-madara-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/madara-backup-$(date +%Y%m%d).tar.gz /data

# Restore
docker run --rm -v vauban-madara-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/madara-backup-YYYYMMDD.tar.gz -C /
```

## Security Considerations

⚠️ **This setup is for DEVELOPMENT only**. For production:

1. **Secrets management**: Use Docker secrets or vault
2. **Network isolation**: Remove `ports:` for internal services
3. **TLS/HTTPS**: Add reverse proxy (nginx/traefik)
4. **Firewall**: Restrict access to RPC endpoints
5. **Monitoring**: Enable authentication on Prometheus/Grafana
6. **Resource limits**: Set memory/CPU limits in docker-compose.yml

## Upgrading Madara

```bash
# Stop devnet
docker-compose down

# Edit docker/madara/Dockerfile
ARG MADARA_VERSION=v0.8.0  # New version

# Rebuild
docker-compose build madara

# Restart
./scripts/start-devnet.sh
```

## Support

For issues:
- Madara: https://github.com/keep-starknet-strange/madara/issues
- Vauban Blog: Check project README or create issue
