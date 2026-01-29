/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the server starts. Used here to launch an in-process
 * scheduler that triggers scheduled-post publishing every 60 seconds.
 *
 * Active in development by default, or when ENABLE_INTERNAL_SCHEDULER=true.
 */
export async function register(): Promise<void> {
  // Only run on the server (Node.js runtime)
  if (typeof window !== 'undefined') return;

  const isDev = process.env.NODE_ENV !== 'production';
  const enabled = isDev || process.env.ENABLE_INTERNAL_SCHEDULER === 'true';

  if (!enabled) return;

  // Dynamic import to avoid bundling server code on the client
  const { eventBus } = await import('@/lib/event-bus');

  const SCHEDULER_INTERVAL_MS = 60_000;
  const STARTUP_DELAY_MS = 5_000;
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005';
  const CRON_SECRET = process.env.CRON_SECRET;

  let intervalId: ReturnType<typeof setInterval> | null = null;

  async function tick(): Promise<void> {
    try {
      const headers: Record<string, string> = {};
      if (CRON_SECRET) {
        headers['Authorization'] = `Bearer ${CRON_SECRET}`;
      }

      const response = await fetch(`${BASE_URL}/api/cron/publish-scheduled`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.warn(`[Scheduler] Cron endpoint returned ${response.status}`);
        return;
      }

      const result = await response.json();

      if (result.published > 0) {
        console.info(
          `[Scheduler] Published ${result.published} scheduled post(s)`,
        );
        eventBus.emit('post:published', {
          postId: 'scheduled',
          title: `${result.published} scheduled post(s)`,
        });
      }
    } catch (error) {
      console.warn(
        '[Scheduler] Failed to poll scheduled posts:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Wait for the server to be ready before starting
  setTimeout(() => {
    console.info('[Scheduler] Starting internal scheduler (interval: 60s)');
    // Run immediately, then every 60s
    void tick();
    intervalId = setInterval(() => void tick(), SCHEDULER_INTERVAL_MS);
  }, STARTUP_DELAY_MS);

  // Cleanup on server shutdown
  process.on('SIGTERM', () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
      console.info('[Scheduler] Stopped internal scheduler');
    }
  });
}
