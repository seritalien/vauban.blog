import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from '@/app/api/health/route';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/health', () => {
  // ===== Happy paths =====

  it('returns 200 status', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
  });

  it('returns status "ok"', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe('ok');
  });

  it('returns a valid ISO 8601 timestamp string', async () => {
    const before = new Date().toISOString();
    const response = await GET();
    const data = await response.json();
    const after = new Date().toISOString();

    expect(typeof data.timestamp).toBe('string');
    // Verify it is a valid ISO date by parsing it
    const parsed = new Date(data.timestamp);
    expect(parsed.toISOString()).toBe(data.timestamp);
    // Verify the timestamp is within the expected window
    expect(data.timestamp >= before).toBe(true);
    expect(data.timestamp <= after).toBe(true);
  });

  it('returns version string from npm_package_version env', async () => {
    vi.stubEnv('npm_package_version', '2.5.0');

    const response = await GET();
    const data = await response.json();

    expect(typeof data.version).toBe('string');
    expect(data.version).toBe('2.5.0');
  });

  it('returns fallback version "0.1.0" when npm_package_version is not set', async () => {
    vi.stubEnv('npm_package_version', '');

    const response = await GET();
    const data = await response.json();

    expect(data.version).toBe('0.1.0');
  });

  // ===== Response shape =====

  it('returns JSON with exactly status, timestamp, and version keys', async () => {
    const response = await GET();
    const data = await response.json();
    const keys = Object.keys(data).sort();

    expect(keys).toEqual(['status', 'timestamp', 'version']);
  });

  it('returns application/json content type', async () => {
    const response = await GET();
    const contentType = response.headers.get('content-type');

    expect(contentType).toContain('application/json');
  });
});
