import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/Icon';
import { itemName, type ShoppingChange, type ShoppingItem } from './items';
import { useShoppingReorder } from './use-shopping-reorder';
import { useShoppingSync } from './use-shopping-sync';
import type { PlannerSync } from '../planners/planner-sync';

export function ShoppingList({ client, token, active, refresh, onBusy, onEdit }: {
  token: string; active: boolean; refresh: number; onBusy: (busy: boolean) => void;
  onEdit: () => void;
  client: PlannerSync;
}) {
  const draft = client.getDraft<{ edit: { id: string; previous?: ShoppingItem }; text: string }>('shopping');
  const [edit, setEdit] = useState<{ id: string; previous?: ShoppingItem } | null>(draft?.edit ?? null);
  const [text, setText] = useState(draft?.text ?? '');
  useEffect(() => { client.setDraft('shopping', edit ? { edit, text } : null); }, [client, edit, text]);
  const input = useRef<HTMLInputElement>(null);
  const focusTarget = useRef('');
  const quickAddAnchor = useRef<{ button: HTMLButtonElement; top: number } | null>(null);
  const reorderingRef = useRef(false);
  const { items, regularItems, loaded, status, error, saving, dirty, conflicts, remoteItems, change, flush, resolveConflict, invalidate, setStatus, clearError } =
    useShoppingSync({ client, token, active, refresh, reordering: reorderingRef });
  useLayoutEffect(() => {
    const anchor = quickAddAnchor.current;
    if (!anchor) return;
    quickAddAnchor.current = null;
    // Changing rows above the catalogue must not move the button under the user's
    // finger. Measure after layout so native scroll anchoring is not applied twice.
    const pane = anchor.button.closest('.planner-panel');
    if (pane) pane.scrollTop += anchor.button.getBoundingClientRect().top - anchor.top;
    anchor.button.focus({ preventScroll: true });
  }, [items]);
  useEffect(() => { if (active && edit) { onEdit(); input.current?.focus(); } }, [active, edit, onEdit]);
  useEffect(() => {
    if (active && !edit && focusTarget.current) {
      const target = document.getElementById(focusTarget.current) as HTMLButtonElement | null;
      (target && !target.disabled ? target : document.getElementById('shopping-add'))?.focus();
      focusTarget.current = '';
    }
  }, [active, edit, saving, items]);

  const commit = (operation: ShoppingChange, finish = false) => {
    if (change(operation) && finish) setEdit(null);
  };
  const beginEdit = (item?: ShoppingItem) => {
    onEdit();
    const id = item?.id ?? crypto.randomUUID();
    focusTarget.current = item ? `shopping-edit-${id}` : 'shopping-add';
    setEdit({ id, previous: item }); setText(item?.text ?? ''); clearError();
  };
  const disabled = !token || !loaded;
  const { list, drag, handleProps, rowProps } = useShoppingReorder({ items, disabled: disabled || Boolean(edit), active,
    onBusy: busy => { reorderingRef.current = busy; invalidate(); onBusy(busy); if (!busy && document.hidden) void flush(); },
    onMove: change => { focusTarget.current = `shopping-reorder-${change.id}`; void commit(change); },
    announce: setStatus,
  });
  const controlsDisabled = disabled || Boolean(edit) || Boolean(drag);
  const present = new Map(items.map(item => [itemName(item.text), item]));
  const conflictFor = (key: string) => {
    if (!conflicts.some(conflict => conflict.key === key)) return null;
    const yours = items.find(item => item.id === key);
    const family = remoteItems.find(item => item.id === key);
    const describe = (item?: ShoppingItem) => item ? `${item.text}${item.checked ? ' (bought)' : ''}` : 'Removed';
    return <div className="item-conflict" role="group" aria-label={key === '$order' ? 'Shopping order conflict' : `Resolve ${yours?.text ?? family?.text ?? 'item'}`}>
      <p>Someone else changed {key === '$order' ? 'the order of the list' : 'this item'}.</p>
      {key === '$order' ? <><p>Yours: {items.map(item => item.text).join(', ')}</p><p>Family: {remoteItems.map(item => item.text).join(', ')}</p></> : <><p>Yours: {describe(yours)}</p><p>Family: {describe(family)}</p></>}
      <div className="meal-actions"><button onClick={() => resolveConflict(key, true)}>Keep mine</button>
        <button onClick={() => resolveConflict(key, false)}>Use family change</button></div>
    </div>;
  };
  return <>
    <p className="sr-only" role="status">{saving ? 'Saving…' : dirty && !status.startsWith('Moving ') && status !== 'Changes waiting to save' ? `${status} Changes waiting to save.` : status}</p>
    {error && !edit && <p className="notice error" role="alert">{error}</p>}
    {dirty && error && !conflicts.length && <button disabled={saving || Boolean(drag)} onClick={() => void flush()}>Retry saving</button>}
    {loaded && items.length === 0 && <p className="unplanned">Your shopping list is empty.</p>}
    <p id="shopping-reorder-help" className="sr-only">Press Space or Enter to pick up an item. Use the arrow keys, Home or End to move it, then Space or Enter to drop. Escape cancels.</p>
    <ol ref={list} className="shopping-list" aria-label="Shopping items">
      {items.map((item, index) => <li className={`shopping-item${drag?.id === item.id ? ' shopping-dragging' : ''}${drag?.valid && drag.beforeId === item.id ? ' shopping-drop-before' : ''}${drag?.valid && drag.beforeId === null && index === items.length - 1 ? ' shopping-drop-after' : ''}`}
        data-shopping-id={item.id} data-draggable={!disabled && !edit && items.length > 1} key={item.id} {...rowProps(item)}>
        <div className="shopping-item-label"><input type="checkbox" checked={item.checked} disabled={controlsDisabled}
          aria-label={`Bought ${item.text}`} onChange={event => {
            void commit({ type: 'check', id: item.id, previous: item.checked, checked: event.target.checked });
          }} /><button id={`shopping-reorder-${item.id}`} className={`shopping-item-name${item.checked ? ' shopping-bought' : ''}`} aria-label={`Reorder ${item.text}`}
            aria-describedby="shopping-reorder-help" aria-pressed={drag?.id === item.id}
            disabled={disabled || Boolean(edit) || items.length < 2 || Boolean(drag && drag.id !== item.id)} {...handleProps(item)}>{item.text}</button></div>
        <div className="shopping-actions">
          <button id={`shopping-edit-${item.id}`} className="icon-button" aria-label={`Edit ${item.text}`} disabled={controlsDisabled} onClick={() => beginEdit(item)}><Icon name="edit" /></button>
          <button className="icon-button" aria-label={`Delete ${item.text}`} title="Delete item" disabled={controlsDisabled} onClick={() => {
            const next = items[index + 1] ?? items[index - 1];
            focusTarget.current = next ? `shopping-edit-${next.id}` : 'shopping-add';
            void commit({ type: 'remove', id: item.id, previous: item });
          }}><Icon name="clear" /></button>
        </div>
        {conflictFor(item.id)}
      </li>)}
      {conflicts.filter(conflict => !items.some(item => item.id === conflict.key)).map(conflict => <li key={`conflict-${conflict.key}`}>{conflictFor(conflict.key)}</li>)}
    </ol>
    {drag?.pointer && drag.moved && <div className="shopping-drag-preview" aria-hidden="true"
      style={{ left: Math.max(8, Math.min(drag.x + 12, window.innerWidth - 248)), top: Math.max(8, Math.min(drag.y + 12, window.innerHeight - 64)) }}>
      {items.find(item => item.id === drag.id)?.text}
    </div>}
    {edit && <form className="meal-editor" aria-label="Edit shopping item" onSubmit={event => {
      event.preventDefault();
      void commit(edit.previous ? { type: 'edit', id: edit.id, previous: edit.previous.text, previousItem: edit.previous, text } : { type: 'add', id: edit.id, text }, true);
    }}>
      {error && <p className="notice error" role="alert">{error}</p>}
      <label htmlFor="shopping-text">Shopping item</label>
      <input id="shopping-text" ref={input} maxLength={300} value={text} disabled={!token} placeholder="For example, apples — 6" onChange={event => setText(event.target.value)} />
      <div className="meal-actions">
        <button type="submit" disabled={!token || !text.trim()}>Save</button>
        <button type="button" onClick={() => setEdit(null)}>Cancel</button>
        {edit.previous && <button type="button" disabled={!token} onClick={() => void commit({ type: 'remove', id: edit.id, previous: edit.previous! }, true)}>Remove item</button>}
      </div>
    </form>}
    <section className="shopping-regular" aria-labelledby="regular-items-title">
      <h3 id="regular-items-title">Regular items</h3>
      <p>Tap to add an item. Tap again to remove it.</p>
      <div className="shopping-quick-add">{regularItems.map(text => {
        const existing = present.get(itemName(text));
        return <button key={text} aria-label={`${text} on shopping list`} aria-pressed={Boolean(existing)}
          data-added={Boolean(existing)} disabled={controlsDisabled} onClick={event => {
            quickAddAnchor.current = { button: event.currentTarget, top: event.currentTarget.getBoundingClientRect().top };
            void commit(existing ? { type: 'remove', id: existing.id, previous: existing }
              : { type: 'add', id: crypto.randomUUID(), text });
          }}>{text}<span style={{ visibility: existing ? 'visible' : 'hidden' }} aria-hidden="true"> — Added</span></button>;
      })}</div>
    </section>
    {!token && <p>To edit the shopping list, connect in Settings.</p>}
    {!edit && <div className="shopping-footer">
      <button id="shopping-add" className="shopping-add" disabled={controlsDisabled} onClick={() => beginEdit()}>Add item</button>
    </div>}
  </>;
}
