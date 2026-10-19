import { useLayoutEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Modal({ title, id, onClose, children, busy = false, headerAction, headerLeading, inline = false }: {
  title: string; id: string; onClose: () => void; children: ReactNode; busy?: boolean; headerAction?: ReactNode; headerLeading?: ReactNode; inline?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pointerStartedOutside = useRef(false);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const focused = element.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
    // Reuse the same dialog and children so layout changes retain meal drafts.
    if (element.open) element.close();
    if (inline) element.show(); else element.showModal();
    focused?.focus({ preventScroll: true });
  }, [inline]);
  const outside = (event: PointerEvent<HTMLDialogElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  };
  return <dialog className={inline ? 'meal-dialog meal-inline' : 'meal-dialog'} ref={dialog} aria-labelledby={id} aria-modal={!inline}
    onClose={event => { if (!event.currentTarget.open) onClose(); }}
    onCancel={event => { if (busy) event.preventDefault(); }}
    onKeyDown={event => {
      if (inline && event.key === 'Escape') {
        event.stopPropagation();
        if (!busy) event.currentTarget.close();
      }
    }}
    onPointerDown={event => { pointerStartedOutside.current = event.button === 0 && outside(event); }}
    onPointerUp={event => {
      if (!inline && !busy && pointerStartedOutside.current && outside(event)) event.currentTarget.close();
      pointerStartedOutside.current = false;
    }} onPointerCancel={() => { pointerStartedOutside.current = false; }}>
    <header className="settings-header meal-header">
      <div className="meal-header-actions">
        <form method="dialog"><button className="icon-button" aria-label="Back to captions" disabled={busy} autoFocus><Icon /></button></form>
        {headerLeading}
      </div>
      <h2 id={id}>{title}</h2>
      <div className="meal-header-actions">{headerAction}</div>
    </header>
    {children}
  </dialog>;
}
