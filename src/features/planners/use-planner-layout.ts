import { useState, useSyncExternalStore } from 'react';
import type { PlannerLayout } from './Planner';

const wideViewport = '(min-width: 768px)';
const canSplit = () => window.matchMedia(wideViewport).matches;
const subscribe = (changed: () => void) => {
  const query = window.matchMedia(wideViewport);
  query.addEventListener('change', changed);
  return () => query.removeEventListener('change', changed);
};

export function usePlannerLayout() {
  const [preferredLayout, setLayout] = useState<PlannerLayout>('full');
  const splitAvailable = useSyncExternalStore(subscribe, canSplit);
  // Keep the preference across resizes without remounting either planner.
  const layout = splitAvailable ? preferredLayout : 'full';
  return { layout, setLayout, splitAvailable };
}
