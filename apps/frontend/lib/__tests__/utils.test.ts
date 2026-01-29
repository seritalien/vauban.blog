import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('utils.ts', () => {
  describe('cn', () => {
    it('merges simple class names', () => {
      const result = cn('foo', 'bar');
      expect(result).toBe('foo bar');
    });

    it('returns empty string with no arguments', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('handles undefined and null values', () => {
      const result = cn('foo', undefined, null, 'bar');
      expect(result).toBe('foo bar');
    });

    it('handles empty string arguments', () => {
      const result = cn('foo', '', 'bar');
      expect(result).toBe('foo bar');
    });

    it('handles boolean false arguments', () => {
      const result = cn('foo', false, 'bar');
      expect(result).toBe('foo bar');
    });

    it('handles conditional class names', () => {
      const isActive = true;
      const isDisabled = false;
      const result = cn('base', isActive && 'active', isDisabled && 'disabled');
      expect(result).toBe('base active');
    });

    it('merges Tailwind classes correctly (last wins)', () => {
      const result = cn('p-4', 'p-2');
      expect(result).toBe('p-2');
    });

    it('merges conflicting Tailwind classes', () => {
      const result = cn('bg-red-500', 'bg-blue-500');
      expect(result).toBe('bg-blue-500');
    });

    it('keeps non-conflicting Tailwind classes', () => {
      const result = cn('p-4', 'mt-2');
      expect(result).toBe('p-4 mt-2');
    });

    it('handles arrays of class names', () => {
      const result = cn(['foo', 'bar']);
      expect(result).toBe('foo bar');
    });

    it('handles objects with boolean values', () => {
      const result = cn({ foo: true, bar: false, baz: true });
      expect(result).toBe('foo baz');
    });

    it('handles mixed arguments (strings, arrays, objects)', () => {
      const result = cn('base', ['arr1', 'arr2'], { conditional: true });
      expect(result).toBe('base arr1 arr2 conditional');
    });

    it('handles number 0 as falsy', () => {
      const result = cn('foo', 0, 'bar');
      expect(result).toBe('foo bar');
    });

    it('preserves non-Tailwind duplicate classes', () => {
      // twMerge only deduplicates conflicting Tailwind utility classes, not arbitrary class names
      const result = cn('foo', 'foo');
      expect(result).toBe('foo foo');
    });

    it('deduplicates conflicting Tailwind utility classes', () => {
      // Tailwind utilities with the same prefix are deduplicated (last wins)
      const result = cn('text-red-500', 'text-blue-500');
      expect(result).toBe('text-blue-500');
    });
  });
});
