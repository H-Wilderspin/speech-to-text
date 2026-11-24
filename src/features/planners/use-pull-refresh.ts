import { useEffect, useState, type RefObject } from 'react';

const threshold = 72;
const controls = 'button, a, input, textarea, select, summary, form, [contenteditable], [data-shopping-id]';

// Listen on the scrolling pane so pulling one side of a split cannot move the
// other. Leave inputs, shopping drags, horizontal gestures and pinch zoom alone.
export function usePullRefresh(panel: RefObject<HTMLElement | null>, enabled: boolean, onRefresh: () => void) {
  const [distance, setDistance] = useState(0);
  useEffect(() => {
    const element = panel.current;
    if (!element || !enabled) return;
    let start: { id: number; x: number; y: number } | undefined;
    let pulled = 0;
    const cancel = () => { start = undefined; pulled = 0; setDistance(0); };
    const begin = (event: TouchEvent) => {
      cancel();
      if (event.touches.length !== 1 || element.scrollTop > 1 ||
        (event.target instanceof Element && event.target.closest(controls))) return;
      const touch = event.touches[0]!;
      start = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
    };
    const move = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.touches[0];
      if (event.touches.length !== 1 || !touch || touch.identifier !== start.id || element.scrollTop > 1) { cancel(); return; }
      const dx = Math.abs(touch.clientX - start.x);
      const dy = touch.clientY - start.y;
      if (dy < -8 || (dx > 8 && dx > dy)) { cancel(); return; }
      if (dy <= 8) { pulled = 0; setDistance(0); return; }
      if (!event.cancelable) { cancel(); return; }
      event.preventDefault();
      pulled = dy;
      setDistance(Math.min(dy, threshold));
    };
    const end = (event: TouchEvent) => {
      const refresh = Boolean(start && event.touches.length === 0 && pulled >= threshold);
      cancel();
      if (refresh) onRefresh();
    };
    element.addEventListener('touchstart', begin, { passive: true });
    element.addEventListener('touchmove', move, { passive: false });
    element.addEventListener('touchend', end);
    element.addEventListener('touchcancel', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    document.addEventListener('visibilitychange', cancel);
    return () => {
      cancel();
      element.removeEventListener('touchstart', begin);
      element.removeEventListener('touchmove', move);
      element.removeEventListener('touchend', end);
      element.removeEventListener('touchcancel', cancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('resize', cancel);
      document.removeEventListener('visibilitychange', cancel);
    };
  }, [panel, enabled, onRefresh]);
  return { pulling: distance > 0, ready: distance >= threshold };
}
