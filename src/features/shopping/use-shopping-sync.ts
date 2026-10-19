import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { readRegularItems, readShoppingList, saveShoppingList } from './github-shopping';
import { applyShoppingChange, ShoppingConflict, type ShoppingChange, type ShoppingList } from './items';
import { mergeShopping, sameList } from './merge-shopping';

type State = {
  base: ShoppingList; items: ShoppingList; regularItems: readonly string[]; loaded: boolean;
  dirty: boolean; saving: boolean; status: string; error: string; conflict: ShoppingList | null;
};
export type ShoppingHandle = { flush: () => Promise<boolean> };

export function useShoppingSync({ token, active, refresh, onBusy, reordering }: {
  token: string; active: boolean; refresh: number; onBusy: (busy: boolean) => void; reordering: RefObject<boolean>;
}) {
  const [state, setState] = useState<State>({ base: [], items: [], regularItems: [], loaded: false,
    dirty: false, saving: false, status: 'Loading shopping list…', error: '', conflict: null });
  const current = useRef(state);
  const generation = useRef(0);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const update = useCallback((changes: Partial<State>) => {
    current.current = { ...current.current, ...changes }; setState(current.current);
  }, []);
  const invalidate = () => { generation.current++; };
  const flush = useCallback((): Promise<boolean> => {
    if (inFlight.current) return inFlight.current;
    const snapshot = current.current;
    if (!snapshot.dirty) return Promise.resolve(true);
    if (reordering.current || snapshot.conflict) return Promise.resolve(false);
    generation.current++; update({ saving: true, error: '' }); onBusy(true);
    const saving = (async () => {
      try {
        const next = await saveShoppingList(snapshot.base, snapshot.items, token);
        update({ base: next, items: next, dirty: false, conflict: null, status: 'Shopping list saved' });
        return true;
      } catch (error) {
        update({ error: error instanceof ShoppingConflict ? 'Another device changed the shopping list. Your unsaved changes are still shown below. Review the shared list before choosing which changes to keep.'
          : error instanceof Error ? error.message : 'Could not save. Your changes are still here; try again.',
          conflict: error instanceof ShoppingConflict ? error.latest : null });
        return false;
      } finally { update({ saving: false }); onBusy(false); inFlight.current = null; }
    })();
    inFlight.current = saving;
    return saving;
  }, [onBusy, reordering, token, update]);

  const change = (change: ShoppingChange): boolean => {
    if (current.current.saving || !token || !current.current.loaded) return false;
    try {
      const next = applyShoppingChange(current.current.items, change);
      const dirty = !sameList(next, current.current.base);
      invalidate(); update({ items: next, dirty, conflict: dirty ? current.current.conflict : null,
        error: dirty && current.current.conflict ? current.current.error : '', status: dirty ? 'Changes waiting to save' : 'Shopping list up to date' });
      return true;
    } catch (error) { update({ error: error instanceof Error ? error.message : 'Could not change this item.' }); return false; }
  };
  const resolveConflict = (keepLocal: boolean) => {
    const snapshot = current.current;
    if (!snapshot.conflict || snapshot.saving) return;
    try {
      const next = keepLocal ? mergeShopping(snapshot.base, snapshot.items, snapshot.conflict, true) : snapshot.conflict;
      const dirty = !sameList(snapshot.conflict, next);
      invalidate(); update({ base: snapshot.conflict, items: next, dirty, conflict: null, error: '', status: dirty ? 'Changes waiting to save' : 'Shared shopping list loaded' });
      if (keepLocal) void flush();
    } catch (error) { update({ error: error instanceof Error ? error.message : 'Could not merge these changes.' }); }
  };
  const lastRefresh = useRef(refresh);
  useEffect(() => {
    const requestedRefresh = lastRefresh.current !== refresh;
    lastRefresh.current = refresh;
    if (!active) return;
    let disposed = false;
    const load = async () => {
      if (document.hidden || current.current.dirty || current.current.saving || reordering.current) return;
      const request = ++generation.current;
      try {
        const [items, regularItems] = await Promise.all([readShoppingList(token), readRegularItems(token)]);
        if (disposed || request !== generation.current) return;
        update({ base: items, items, regularItems, loaded: true, conflict: null, error: '', status: 'Shopping list updated' });
      } catch (error) {
        if (!disposed && request === generation.current) update({ status: 'Could not refresh shopping list', error: error instanceof Error ? error.message : 'Could not load the shopping list. Try again.' });
      }
    };
    void (async () => { if (requestedRefresh && current.current.dirty && !await flush()) return; if (!disposed) await load(); })();
    const timer = window.setInterval(() => void load(), 60000);
    const focus = () => void load();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => { disposed = true; clearInterval(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [active, token, refresh, flush, reordering, update]);

  useEffect(() => {
    const timer = window.setInterval(() => { if (!reordering.current) void flush(); }, 30000);
    const leaving = () => { if (document.hidden) void flush(); };
    document.addEventListener('visibilitychange', leaving);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', leaving); };
  }, [flush, reordering]);
  useEffect(() => {
    if (!state.dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (!current.current.dirty) return;
      void flush(); event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [state.dirty, flush]);
  return { ...state, change, flush, resolveConflict, invalidate, setStatus: (status: string) => update({ status }), clearError: () => { if (!current.current.conflict) update({ error: '' }); } };
}
