import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react';
import type { ShoppingChange, ShoppingItem } from './items';

type DragView = { id: string; beforeId: string | null; toIndex: number; x: number; y: number; pointer: boolean; moved: boolean; valid: boolean };
type DragStart = { clientX: number; clientY: number; pointerId?: number; touchId?: number };

export function useShoppingReorder({ items, disabled, active, onBusy, onMove, announce }: {
  items: ShoppingItem[]; disabled: boolean; active: boolean;
  onBusy: (busy: boolean) => void;
  onMove: (change: Extract<ShoppingChange, { type: 'move' }>) => void;
  announce: (message: string) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const session = useRef<{ cancel: () => void; drop: () => void } | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const [drag, setDrag] = useState<DragView | null>(null);
  useEffect(() => () => { pending.current?.(); session.current?.cancel(); }, []);
  useEffect(() => { if (disabled || !active) { pending.current?.(); session.current?.cancel(); } }, [disabled, active]);

  const begin = (item: ShoppingItem, handle: HTMLButtonElement, pointer?: DragStart) => {
    if (disabled || !active || session.current || items.length < 2 || !list.current) return;
    const pane = list.current.closest('dialog')!;
    const order = items.map(item => item.id);
    const otherIds = order.filter(id => id !== item.id);
    const originalIndex = order.indexOf(item.id);
    let current: DragView = { id: item.id, beforeId: otherIds[originalIndex] ?? null, toIndex: originalIndex,
      x: pointer?.clientX ?? 0, y: pointer?.clientY ?? 0, pointer: Boolean(pointer), moved: false, valid: true };
    const startX = current.x, startY = current.y, pointerId = pointer?.pointerId;
    let frame = 0;
    let previousTime = 0;
    let ended = false;
    const publish = (next: DragView) => {
      if (next.toIndex !== current.toIndex) announce(`Moving ${item.text}. Position ${next.toIndex + 1} of ${order.length}.`);
      current = next; setDrag(next);
    };
    const finish = (save: boolean) => {
      if (ended) return;
      ended = true; cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancelPointer);
      window.removeEventListener('pointerdown', outsidePointer, true);
      window.removeEventListener('touchmove', touchMove);
      window.removeEventListener('touchend', touchEnd);
      window.removeEventListener('touchcancel', cancel);
      window.removeEventListener('touchstart', cancel);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('resize', cancel);
      document.removeEventListener('visibilitychange', visibility);
      handle.removeEventListener('lostpointercapture', cancel);
      if (pointerId !== undefined && handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      session.current = null; setDrag(null); onBusy(false);
      handle.focus({ preventScroll: true });
      if (save && current.valid && current.toIndex !== originalIndex && (!pointer || current.moved)) {
        onMove({ type: 'move', id: item.id, toIndex: current.toIndex, previousOrder: order });
      } else announce(save ? 'Shopping order unchanged.' : 'Move cancelled.');
    };
    const cancel = () => finish(false);
    const visibility = () => { if (document.hidden) cancel(); };
    const updateTarget = (x: number, y: number) => {
      const bounds = list.current!.getBoundingClientRect();
      const paneBounds = pane.getBoundingClientRect();
      const headerBottom = pane.querySelector('header')!.getBoundingClientRect().bottom;
      const valid = x >= bounds.left && x <= bounds.right && y >= Math.max(bounds.top, headerBottom)
        && y <= Math.min(bounds.bottom, paneBounds.bottom, innerHeight);
      const rows = [...list.current!.querySelectorAll<HTMLElement>('[data-shopping-id]')].filter(row => row.dataset.shoppingId !== item.id);
      const toIndex = rows.filter(row => { const rect = row.getBoundingClientRect(); return y > rect.top + rect.height / 2; }).length;
      if (current.x !== x || current.y !== y || current.toIndex !== toIndex || current.valid !== valid || !current.moved) {
        publish({ ...current, x, y, valid, toIndex, beforeId: otherIds[toIndex] ?? null, moved: true });
      }
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      event.preventDefault();
      if (current.moved || Math.hypot(event.clientX - startX, event.clientY - startY) >= 6) updateTarget(event.clientX, event.clientY);
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      if (current.moved) updateTarget(event.clientX, event.clientY);
      finish(true);
    };
    const cancelPointer = (event: PointerEvent) => { if (event.pointerId === pointerId) cancel(); };
    const touchMove = (event: TouchEvent) => {
      const touch = [...event.touches].find(touch => touch.identifier === pointer?.touchId);
      if (!touch || event.touches.length !== 1 || !event.cancelable) { cancel(); return; }
      event.preventDefault();
      updateTarget(touch.clientX, touch.clientY);
    };
    const touchEnd = (event: TouchEvent) => {
      const touch = [...event.changedTouches].find(touch => touch.identifier === pointer?.touchId);
      if (!touch) return;
      if (event.cancelable) event.preventDefault();
      if (current.moved) updateTarget(touch.clientX, touch.clientY);
      finish(true);
    };
    const outsidePointer = () => cancel();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); return; }
      if (pointer) return;
      if (event.key === 'Tab') { cancel(); return; }
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End', ' ', 'Enter'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === ' ' || event.key === 'Enter') { finish(true); return; }
      const toIndex = event.key === 'Home' ? 0 : event.key === 'End' ? order.length - 1
        : Math.max(0, Math.min(order.length - 1, current.toIndex + (event.key === 'ArrowUp' ? -1 : 1)));
      publish({ ...current, toIndex, beforeId: otherIds[toIndex] ?? null });
      const targetId = otherIds[toIndex] ?? otherIds.at(-1);
      list.current?.querySelector<HTMLElement>(`[data-shopping-id="${targetId}"]`)?.scrollIntoView({ block: 'nearest' });
    };
    const scroll = (time: number) => {
      if (ended) return;
      const elapsed = previousTime ? Math.min(time - previousTime, 32) : 16;
      previousTime = time;
      if (current.moved) {
        const bounds = pane.getBoundingClientRect();
        const top = pane.querySelector('header')!.getBoundingClientRect().bottom;
        const bottom = Math.min(bounds.bottom, innerHeight);
        if (current.x >= bounds.left && current.x <= bounds.right && current.y >= top && current.y <= bottom) {
          const edge = Math.min(48, (bottom - top) / 3);
          const speed = current.y < top + edge ? -1 : current.y > bottom - edge ? 1 : 0;
          if (speed) {
            // Stop at the list ends instead of scrolling past them into the catalogue.
            const listBounds = list.current!.getBoundingClientRect();
            const delta = speed * elapsed * .5;
            pane.scrollTop += speed > 0 ? Math.min(delta, Math.max(0, listBounds.bottom - current.y - 2))
              : Math.max(delta, Math.min(0, listBounds.top - current.y + 2));
            updateTarget(current.x, current.y);
          }
        }
      }
      frame = requestAnimationFrame(scroll);
    };
    session.current = { cancel, drop: () => finish(true) };
    handle.focus({ preventScroll: true });
    onBusy(true); setDrag(current);
    announce(`Moving ${item.text}. Position ${originalIndex + 1} of ${order.length}.`);
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    window.addEventListener('pointerdown', outsidePointer, true);
    document.addEventListener('visibilitychange', visibility);
    if (pointerId !== undefined) {
      handle.setPointerCapture(pointerId);
      handle.addEventListener('lostpointercapture', cancel);
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancelPointer);
      frame = requestAnimationFrame(scroll);
    } else if (pointer?.touchId !== undefined) {
      window.addEventListener('touchmove', touchMove, { passive: false });
      window.addEventListener('touchend', touchEnd, { passive: false });
      window.addEventListener('touchcancel', cancel);
      window.addEventListener('touchstart', cancel);
      frame = requestAnimationFrame(scroll);
    }
  };
  const rowHandle = (row: HTMLElement) => row.querySelector<HTMLButtonElement>('.shopping-item-name');
  const isControl = (target: EventTarget) => target instanceof Element && Boolean(target.closest('button:not(.shopping-item-name), input, select, textarea, a, label'));
  const holdToDrag = (item: ShoppingItem, event: ReactTouchEvent<HTMLLIElement>) => {
    if (disabled || !active || session.current || pending.current || items.length < 2 || event.touches.length !== 1 || isControl(event.target)) return;
    const handle = rowHandle(event.currentTarget);
    const touch = event.touches[0]!;
    if (!handle) return;
    // Listen without cancelling the initial touch. A swipe cancels the hold and
    // remains native scrolling; only movement after pickup prevents scrolling.
    const cancel = () => {
      clearTimeout(timer); pending.current = null; onBusy(false);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', cancel);
      window.removeEventListener('touchcancel', cancel);
      window.removeEventListener('touchstart', cancel, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('resize', cancel);
      window.removeEventListener('keydown', cancel);
      document.removeEventListener('visibilitychange', cancel);
    };
    const move = (event: TouchEvent) => {
      const next = [...event.touches].find(next => next.identifier === touch.identifier);
      if (!next || Math.hypot(next.clientX - touch.clientX, next.clientY - touch.clientY) > 8) cancel();
    };
    const timer = window.setTimeout(() => {
      cancel(); begin(item, handle, { clientX: touch.clientX, clientY: touch.clientY, touchId: touch.identifier });
    }, 350);
    pending.current = cancel; onBusy(true);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', cancel);
    window.addEventListener('touchcancel', cancel);
    // This touchstart is still bubbling; ignore it and cancel only a second touch.
    window.addEventListener('touchstart', cancel, { capture: true });
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    window.addEventListener('keydown', cancel);
    document.addEventListener('visibilitychange', cancel);
  };
  return {
    list, drag,
    rowProps: (item: ShoppingItem) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLLIElement>) => {
        if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0 || isControl(event.target)) return;
        const handle = rowHandle(event.currentTarget);
        if (handle) { event.preventDefault(); begin(item, handle, event); }
      },
      onTouchStart: (event: ReactTouchEvent<HTMLLIElement>) => holdToDrag(item, event),
      onContextMenu: (event: React.MouseEvent<HTMLLIElement>) => { if (pending.current || session.current) event.preventDefault(); },
    }),
    handleProps: (item: ShoppingItem) => ({
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        // Pointer releases are handled above; keyboard and assistive clicks use pickup/drop.
        if (event.detail !== 0) return;
        if (session.current) session.current.drop(); else begin(item, event.currentTarget);
      },
    }),
  };
}
