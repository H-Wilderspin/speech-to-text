import { useEffect, useRef, useState, type RefObject } from 'react';
import { readRegularItems } from './github-shopping';
import { regularItems as bundledItems } from './regular-items';
import { moveShoppingItem, itemName, type ShoppingChange } from './items';
import type { PlannerSync } from '../planners/planner-sync';
import { useSyncDocument } from '../planners/use-sync-document';
import type { ShoppingEdit } from './shopping-document';

export function useShoppingSync({ client, token, active, refresh, reordering }: {
  client: PlannerSync; token: string; active: boolean; refresh: number; reordering: RefObject<boolean>;
}) {
  const store = client.shopping();
  const snapshot = useSyncDocument(client, store, active, refresh);
  const [regularItems, setRegularItems] = useState<readonly string[]>(bundledItems);
  const [localError, setLocalError] = useState('');
  const [removal, setRemoval] = useState<{ edit: ShoppingEdit; inverse: Extract<ShoppingEdit, { type: 'restore' }> } | null>(null);
  const [announcement, setAnnouncement] = useState<{ message: string; snapshot: typeof snapshot } | null>(null);
  const previousRefresh = useRef(refresh);
  useEffect(() => {
    const explicit = previousRefresh.current !== refresh;
    previousRefresh.current = refresh;
    if (!active && !explicit) return;
    let disposed = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const next = await readRegularItems(token);
        if (!disposed) setRegularItems(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      } catch { /* Keep the last usable catalogue, including the bundled offline fallback. */ }
    };
    void load();
    const timer = active ? setInterval(() => void load(), 300000) : undefined;
    return () => { disposed = true; clearInterval(timer); };
  }, [active, refresh, token]);
  const change = (change: ShoppingChange) => {
    if (!token || !snapshot.loaded) return false;
    const items = store.getSnapshot().value.items;
    const current = items.find(item => item.id === change.id) ?? (change.type === 'edit' ? change.previousItem : undefined);
    try {
      let edit: ShoppingEdit;
      if (change.type === 'move') {
        const next = moveShoppingItem(items, change);
        edit = { type: 'move', id: change.id, previousOrder: change.previousOrder, order: next.map(item => item.id) };
      } else if (change.type === 'remove') edit = { type: 'remove', id: change.id, previous: change.previous };
      else if (change.type === 'add') {
        if (items.some(item => itemName(item.text) === itemName(change.text))) return true;
        edit = { type: 'put', id: change.id, item: { id: change.id, text: change.text.trim(), checked: false } };
      } else {
        if (!current) throw new Error('This item was removed by someone else. Add it again to keep it.');
        if (change.type === 'edit' && items.some(item => item.id !== change.id && itemName(item.text) === itemName(change.text))) {
          throw new Error('That item is already on the shopping list.');
        }
        const previous = change.type === 'edit' ? { ...current, text: change.previous } : { ...current, checked: change.previous };
        const item = change.type === 'edit' ? { ...current, text: change.text.trim() } : { ...current, checked: change.checked };
        edit = { type: 'put', id: change.id, previous, item };
      }
      setLocalError(''); setAnnouncement(null);
      const changed = store.change(edit);
      if (changed && change.type === 'remove') setRemoval({ edit,
        inverse: { type: 'restore', id: change.id, item: change.previous, order: items.map(item => item.id) } });
      return changed;
    } catch (error) { setLocalError(error instanceof Error ? error.message : 'Could not change this item.'); return false; }
  };
  const status = (announcement?.snapshot === snapshot ? announcement.message : '') || (snapshot.saving ? 'Saving shopping changes' : snapshot.pending ? 'Shopping changes waiting to sync' : snapshot.status === 'Saved' ? 'Shopping list saved' : snapshot.loaded ? 'Shopping list updated' : 'Loading shopping list');
  return { items: snapshot.value.items, regularItems, loaded: snapshot.loaded, status,
    error: localError || snapshot.error, saving: snapshot.saving, dirty: snapshot.pending > 0,
    conflicts: snapshot.conflicts, remoteItems: store.getRemote().items,
    change, flush: store.flush, removedItem: removal?.inverse.item,
    undoRemoval: () => {
      if (!removal || !store.undoChange(removal.edit, removal.inverse)) return false;
      setRemoval(null); return true;
    }, dismissRemoval: () => setRemoval(null),
    resolveConflict: (key: string, keepLocal: boolean) => store.resolve(key, keepLocal),
    invalidate: () => store.hold(reordering.current), setStatus: (message: string) => setAnnouncement({ message, snapshot: store.getSnapshot() }), clearError: () => setLocalError('') };
}
