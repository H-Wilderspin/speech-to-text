import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { PlannerSync } from './planner-sync';
import type { SyncDocument } from './sync-document';

export function useSyncDocument<T, C>(client: PlannerSync, document: SyncDocument<T, C>, active: boolean, refresh: number) {
  const state = useSyncExternalStore(document.subscribe, document.getSnapshot);
  useEffect(() => {
    let disposed = false;
    void client.ready.then(() => { if (!disposed) document.activate(active); });
    return () => { disposed = true; document.activate(false); };
  }, [client, document, active]);
  const previous = useRef(refresh);
  useEffect(() => {
    if (previous.current === refresh) return;
    previous.current = refresh;
    void document.flush().then(saved => { if (saved) return document.refresh(); });
  }, [document, refresh]);
  return state;
}
