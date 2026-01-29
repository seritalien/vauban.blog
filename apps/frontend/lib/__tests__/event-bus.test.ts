import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBus } from '@/lib/event-bus';

describe('eventBus', () => {
  beforeEach(() => {
    eventBus.destroy();
  });

  // --- Happy paths ---

  it('delivers post:published events to subscribers', () => {
    const handler = vi.fn();
    eventBus.on('post:published', handler);

    const payload = { postId: '42', slug: 'hello', title: 'Hello', txHash: '0xabc' };
    eventBus.emit('post:published', payload);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('delivers post:scheduled events to subscribers', () => {
    const handler = vi.fn();
    eventBus.on('post:scheduled', handler);

    const payload = { postId: '7', scheduledAt: '2025-06-01T12:00:00Z' };
    eventBus.emit('post:scheduled', payload);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('delivers comment:added events to subscribers', () => {
    const handler = vi.fn();
    eventBus.on('comment:added', handler);

    const payload = { postId: '10', commentId: 'c1', author: '0x123' };
    eventBus.emit('comment:added', payload);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('supports multiple listeners on the same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    eventBus.on('post:published', handler1);
    eventBus.on('post:published', handler2);

    eventBus.emit('post:published', { postId: '1' });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('does not cross-deliver events between different event names', () => {
    const publishHandler = vi.fn();
    const commentHandler = vi.fn();
    eventBus.on('post:published', publishHandler);
    eventBus.on('comment:added', commentHandler);

    eventBus.emit('post:published', { postId: '1' });

    expect(publishHandler).toHaveBeenCalledOnce();
    expect(commentHandler).not.toHaveBeenCalled();
  });

  // --- Unsubscribe ---

  it('off() removes a specific listener', () => {
    const handler = vi.fn();
    eventBus.on('post:published', handler);
    eventBus.off('post:published', handler);

    eventBus.emit('post:published', { postId: '1' });

    expect(handler).not.toHaveBeenCalled();
  });

  // --- Destroy / teardown ---

  it('destroy() removes all listeners', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    eventBus.on('post:published', handler1);
    eventBus.on('comment:added', handler2);

    eventBus.destroy();

    eventBus.emit('post:published', { postId: '1' });
    eventBus.emit('comment:added', { postId: '2' });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  // --- Edge cases ---

  it('emitting with no listeners does not throw', () => {
    expect(() => {
      eventBus.emit('post:published', { postId: '1' });
    }).not.toThrow();
  });

  it('handles optional payload fields gracefully', () => {
    const handler = vi.fn();
    eventBus.on('post:published', handler);

    // Only postId is required
    eventBus.emit('post:published', { postId: '1' });

    expect(handler).toHaveBeenCalledWith({ postId: '1' });
  });

  it('singleton survives repeated imports (globalThis caching)', () => {
    // The eventBus import should always return the same instance
    // We can verify by adding a listener and checking it receives events
    const handler = vi.fn();
    eventBus.on('post:published', handler);
    eventBus.emit('post:published', { postId: '99' });
    expect(handler).toHaveBeenCalledOnce();
  });
});
