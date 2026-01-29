import { EventEmitter } from 'events';

/**
 * Typed event payloads for the in-process event bus.
 *
 * Each key is an event name emitted after a server-side action
 * (e.g. M2M publish, comment relay) so that the SSE endpoint
 * can forward the notification to connected browser tabs.
 */
export interface EventPayloads {
  'post:published': { postId: string; slug?: string; title?: string; txHash?: string };
  'post:scheduled': { postId: string; scheduledAt: string };
  'comment:added': { postId: string; commentId?: string; author?: string };
  'post:approved': { postId: string };
  'post:rejected': { postId: string; reason?: string };
  'message:received': { conversationId: string; from: string };
  'user:banned': { address: string };
  'user:unbanned': { address: string };
}

export type EventName = keyof EventPayloads;

/**
 * Typed wrapper around Node.js EventEmitter.
 *
 * Shared singleton across the entire Next.js server process so that
 * API route handlers can emit events consumed by the SSE stream endpoint.
 */
class TypedEventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    // Support many concurrent SSE connections (one listener per open tab)
    this.emitter.setMaxListeners(100);
  }

  emit<K extends EventName>(event: K, payload: EventPayloads[K]): void {
    this.emitter.emit(event, payload);
  }

  on<K extends EventName>(event: K, handler: (payload: EventPayloads[K]) => void): void {
    this.emitter.on(event, handler);
  }

  off<K extends EventName>(event: K, handler: (payload: EventPayloads[K]) => void): void {
    this.emitter.off(event, handler);
  }

  /** Remove all listeners — useful for test teardown. */
  destroy(): void {
    this.emitter.removeAllListeners();
  }
}

/**
 * Singleton event bus shared across the Node.js process.
 *
 * Survives hot-reload in development by attaching to `globalThis`.
 */
function getEventBus(): TypedEventBus {
  const key = '__vauban_event_bus__' as const;
  const g = globalThis as unknown as Record<string, TypedEventBus | undefined>;

  if (!g[key]) {
    g[key] = new TypedEventBus();
  }

  return g[key];
}

export const eventBus = getEventBus();
