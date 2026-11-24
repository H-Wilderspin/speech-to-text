import { useEffect, type RefObject } from 'react';

const controls = 'a, input, textarea, select, summary, form, [contenteditable], button:not(.meal-slot)';

export function useWeekSwipe(panel: RefObject<HTMLElement | null>, enabled: boolean, changeWeek: (direction: number) => void) {
  useEffect(() => {
    const element = panel.current;
    if (!element || !enabled) return;
    let start: { id: number; x: number; y: number } | undefined;
    let horizontal = false;
    let distance = 0;
    const cancel = () => { start = undefined; horizontal = false; distance = 0; };
    const begin = (event: TouchEvent) => {
      cancel();
      if (event.touches.length !== 1 || (event.target instanceof Element && event.target.closest(controls))) return;
      const touch = event.touches[0]!;
      start = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
    };
    const move = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.touches[0];
      if (event.touches.length !== 1 || !touch || touch.identifier !== start.id) { cancel(); return; }
      const dx = touch.clientX - start.x;
      const dy = Math.abs(touch.clientY - start.y);
      if (!horizontal) {
        if (Math.abs(dx) >= 10 && Math.abs(dx) > dy * 1.5) horizontal = true;
        else if (dy >= 10) { cancel(); return; }
        else return;
      }
      if (!event.cancelable || dy > Math.abs(dx)) { cancel(); return; }
      // Only claim sideways gestures. Vertical scrolling and pull-to-refresh
      // keep their native behaviour; taps on meal cards still open the editor.
      event.preventDefault();
      distance = dx;
    };
    const end = (event: TouchEvent) => {
      const navigate = start && horizontal && event.touches.length === 0 && Math.abs(distance) >= 60;
      const direction = distance < 0 ? 1 : -1;
      if (horizontal && event.cancelable) event.preventDefault(); // No accidental meal-card click after a swipe.
      cancel();
      if (navigate) changeWeek(direction);
    };
    element.addEventListener('touchstart', begin, { passive: true });
    element.addEventListener('touchmove', move, { passive: false });
    element.addEventListener('touchend', end, { passive: false });
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
  }, [panel, enabled, changeWeek]);
}
