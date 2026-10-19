import { useState, useSyncExternalStore } from 'react';
import type { PlannerLayout } from './Planner';

const wideViewport = '(min-width: 768px)';
const canSplitVertically = () => window.matchMedia(wideViewport).matches;
const subscribe = (changed: () => void) => {
  const query = window.matchMedia(wideViewport);
  query.addEventListener('change', changed);
  return () => query.removeEventListener('change', changed);
};

export function usePlannerLayout() {
  const [preferredLayout, setLayout] = useState<PlannerLayout>('full');
  const verticalSplitAvailable = useSyncExternalStore(subscribe, canSplitVertically);
  // Keep the preference across resizes without remounting either planner.
  const layout = preferredLayout === 'vertical' && !verticalSplitAvailable ? 'horizontal' : preferredLayout;
  return { layout, setLayout, verticalSplitAvailable };
}
