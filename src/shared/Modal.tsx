import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Modal({ title, id, onClose, children, busy = false, headerAction }: {
  title: string; id: string; onClose: () => void; children: ReactNode; busy?: boolean; headerAction?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pointerStartedOutside = useRef(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const outside = (event: PointerEvent<HTMLDialogElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  };
  return <dialog className="meal-dialog" ref={dialog} aria-labelledby={id} onClose={onClose}
    onCancel={event => { if (busy) event.preventDefault(); }}
    onPointerDown={event => { pointerStartedOutside.current = event.button === 0 && outside(event); }}
    onPointerUp={event => {
      if (!busy && pointerStartedOutside.current && outside(event)) event.currentTarget.close();
      pointerStartedOutside.current = false;
    }} onPointerCancel={() => { pointerStartedOutside.current = false; }}>
    <header className="settings-header">
      <form method="dialog"><button className="icon-button" aria-label="Back to captions" disabled={busy} autoFocus><Icon /></button></form>
      <h2 id={id}>{title}</h2>
      {headerAction}
    </header>
    {children}
  </dialog>;
}
