import { useEffect, useState } from 'react';

// Drives re-render so the list visibly re-sorts as tasks cross band
// boundaries, with no polling and no manual refresh. Paused while the tab is
// hidden (nothing to show anyone), and ticks immediately on becoming visible
// so the score isn't stale the moment you switch back.
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;

    function tick() {
      setNow(Date.now());
    }

    function start() {
      tick();
      id = setInterval(tick, intervalMs);
    }

    function stop() {
      if (id !== undefined) {
        clearInterval(id);
        id = undefined;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        stop();
      } else {
        start();
      }
    }

    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs]);

  return now;
}
