import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/Icon';
import { addDays, dateKey, monday } from '../meals/calendar';
import { MealWeek } from '../meals/MealPlanner';
import { ShoppingList } from '../shopping/ShoppingList';
import type { PlannerSync } from './planner-sync';
import { usePullRefresh } from './use-pull-refresh';
import { useWeekSwipe } from '../meals/use-week-swipe';

export type PlannerLayout = 'full' | 'split';

export type PlannerKind = 'meals' | 'shopping';

export function Planner({ client, token, visible, layout, refresh, kind, busy, onBusy, onRefresh }: {
  client: PlannerSync;
  refresh: number;
  onRefresh: () => void;
  kind: PlannerKind; busy: boolean; onBusy: (busy: boolean) => void; token: string; visible: boolean; layout: PlannerLayout;
}) {
  const [today, setToday] = useState(() => new Date());
  const [start, setStart] = useState(() => monday(new Date()));
  const panel = useRef<HTMLElement>(null);
  const changeWeek = useCallback((direction: number) => setStart(value => addDays(value, direction * 7)), []);
  useWeekSwipe(panel, visible && kind === 'meals' && !busy, changeWeek);
  const pull = usePullRefresh(panel, visible && !busy, onRefresh);
  const header = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = header.current!;
    const measure = () => {
      const height = element.getBoundingClientRect().height;
      if (height > 0) panel.current?.style.setProperty('--planner-header-height', `${height}px`);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const week = dateKey(start);
  const end = addDays(start, 6);
  const thisWeek = dateKey(monday(today));
  return <section ref={panel} id="planner-panel" className={layout === 'split' ? 'app-panel planner-panel planner-split' : 'app-panel planner-panel'} hidden={!visible} aria-labelledby="planner-title">
    <header ref={header} className="settings-header meal-header">
      {kind === 'meals' && <button className="icon-button" aria-label="Previous week" disabled={busy} onClick={() => changeWeek(-1)}><Icon name="previous" /></button>}
      <div className="planner-heading">
        <h2 id="planner-title">{kind === 'meals' ? 'Meal planner' : 'Shopping list'}</h2>
        {kind === 'meals' && <p className="week-heading" aria-live="polite">{start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{start.getFullYear() !== end.getFullYear() ? `, ${start.getFullYear()}` : ''} - {end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {end.getFullYear()}</p>}
      </div>
      {kind === 'meals' && <button className="icon-button" aria-label="Next week" disabled={busy} onClick={() => changeWeek(1)}><Icon name="next" /></button>}
    </header>
    {pull.pulling && <p className="pull-refresh-status" role="status">{pull.ready ? 'Release to sync and refresh' : 'Pull down to sync and refresh'}</p>}
    <div className={kind === 'shopping' ? 'meal-content shopping-content' : 'meal-content'}>
      <div className="week-navigation" hidden={kind === 'shopping' || week === thisWeek}>
        {week !== thisWeek && <button className="this-week" disabled={busy} onClick={() => setStart(monday(new Date()))}>This week</button>}
      </div>
      <div hidden={kind !== 'meals'}><MealWeek client={client} key={week} start={start} today={dateKey(today)} token={token} refresh={refresh} active={visible && kind === 'meals'} /></div>
      <div className="shopping-view" hidden={kind !== 'shopping'}><ShoppingList client={client} token={token} refresh={refresh} onBusy={onBusy} active={visible && kind === 'shopping'} /></div>
    </div>
  </section>;
}
