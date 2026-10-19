import { useEffect, useState } from 'react';
import { Icon } from '../../shared/Icon';
import { Modal } from '../../shared/Modal';
import { addDays, dateKey, monday } from '../meals/calendar';
import { MealWeek } from '../meals/MealPlanner';
import { CleaningWeek } from '../cleaning/CleaningWeek';

export type PlannerLayout = 'full' | 'vertical' | 'horizontal';

export type PlannerKind = 'meals' | 'cleaning';

export function Planner({ token, onClose, layout, onLayout, kind, busy, onBusy }: {
  kind: PlannerKind; busy: boolean; onBusy: (busy: boolean) => void; token: string; onClose: () => void; layout: PlannerLayout; onLayout: (value: PlannerLayout) => void;
}) {
  const [today, setToday] = useState(() => new Date());
  const [start, setStart] = useState(() => monday(new Date()));
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const week = dateKey(start);
  const end = addDays(start, 6);
  const thisWeek = dateKey(monday(today));
  return <Modal title={kind === 'meals' ? 'Meal planner' : 'Task planner'} id="planner-title" onClose={onClose} busy={busy} inline={layout !== 'full'}
    headerLeading={<button className="icon-button" aria-label="Refresh" title="Refresh plan" disabled={busy} onClick={() => setRefresh(value => value + 1)}><Icon name="refresh" /></button>}
    headerAction={<>{(['vertical', 'horizontal'] as const).map(mode => {
      const label = mode === 'vertical' ? 'Vertical split (side by side)' : 'Horizontal split (stacked)';
      return <button key={mode} className="icon-button split-button" aria-label={label} aria-pressed={layout === mode}
        title={layout === mode ? 'Return to full planner' : label} disabled={busy}
        onClick={event => { event.currentTarget.focus(); onLayout(layout === mode ? 'full' : mode); }}><Icon name={`split-${mode}`} /></button>;
    })}</>}>
    <div className="meal-content">
      <nav className="week-navigation" aria-label="Choose week">
        <button className="icon-button" aria-label="Previous week" disabled={busy} onClick={() => setStart(value => addDays(value, -7))}><Icon name="previous" /></button>
        <div><p className="week-heading">{start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{start.getFullYear() !== end.getFullYear() ? `, ${start.getFullYear()}` : ''} - {end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {end.getFullYear()}</p>
          {week !== thisWeek && <button className="this-week" disabled={busy} onClick={() => setStart(monday(new Date()))}>This week</button>}</div>
        <button className="icon-button" aria-label="Next week" disabled={busy} onClick={() => setStart(value => addDays(value, 7))}><Icon name="next" /></button>
      </nav>
      <div hidden={kind !== 'meals'}><MealWeek key={week} start={start} today={dateKey(today)} token={token} refresh={refresh} onBusy={onBusy} active={kind === 'meals'} /></div>
      <div hidden={kind !== 'cleaning'}><CleaningWeek key={week} start={start} today={dateKey(today)} token={token} refresh={refresh} onBusy={onBusy} active={kind === 'cleaning'} /></div>
    </div>
  </Modal>;
}
