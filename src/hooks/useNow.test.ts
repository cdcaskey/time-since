import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNow } from './useNow';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useNow', () => {
  it('ticks on the given interval', () => {
    const { result } = renderHook(() => useNow(1000));
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBeGreaterThan(initial);
  });

  it('stops ticking while the document is hidden', () => {
    const { result } = renderHook(() => useNow(1000));

    act(() => {
      setVisibility('hidden');
      vi.advanceTimersByTime(5000);
    });

    const whileHidden = result.current;

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current).toBe(whileHidden);
  });

  it('ticks immediately on becoming visible again', () => {
    const { result } = renderHook(() => useNow(1000));

    act(() => {
      setVisibility('hidden');
    });

    const beforeReveal = Date.now();
    act(() => {
      vi.setSystemTime(beforeReveal + 500);
      setVisibility('visible');
    });

    expect(result.current).toBe(beforeReveal + 500);
  });
});
