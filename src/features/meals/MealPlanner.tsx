import { useEffect, useRef, useState } from 'react';
import { dateKey, defaultMealKey, mealKey, mealSlots, resolvedMeal, weekdayNames, weekDays, type MealValue } from './calendar';
import type { PlannerSync } from '../planners/planner-sync';
import { useSyncDocument } from '../planners/use-sync-document';
const dayLabel = (date: Date) => date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
type MealEditor = { key: string; defaultKey: string; label: string; repeatLabel: string; previous: MealValue; defaultPrevious: MealValue; text: string };
type Draft = { edit: MealEditor | null; scope: 'date' | 'default'; text: string };

export function MealWeek({ client, start, today, token, refresh, active }: {
  client: PlannerSync; active: boolean; start: Date; today: string; token: string; refresh: number;
}) {
  const week = dateKey(start);
  const weekStore = client.meals(week);
  const defaultStore = client.meals();
  const weekly = useSyncDocument(client, weekStore, active, refresh);
  const recurring = useSyncDocument(client, defaultStore, active, refresh);
  const plan = weekly.value.meals;
  const defaults = recurring.value.meals;
  const loaded = weekly.loaded && recurring.loaded;
  const savedDraft = client.getDraft<Draft>(week);
  const [edit, setEdit] = useState<MealEditor | null>(savedDraft?.edit ?? null);
  const [scope, setScope] = useState<'date' | 'default'>(savedDraft?.scope ?? 'date');
  const [text, setText] = useState(savedDraft?.text ?? '');
  const error = weekly.error || recurring.error;
  const saving = weekly.saving || recurring.saving;
  const status = saving ? 'Saving meal changes' : weekly.pending || recurring.pending ? 'Meal changes waiting to sync' : loaded ? 'Plan updated' : 'Loading meal plan';
  const selected = useRef<HTMLButtonElement | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { client.setDraft(week, edit ? { edit, scope, text } : null); }, [client, week, edit, scope, text]);
  useEffect(() => { if (active && edit) editor.current?.focus(); }, [edit, active]);
  useEffect(() => {
    if (active && !edit && selected.current && !selected.current.disabled) { selected.current.focus(); selected.current = null; }
  }, [edit, active]);
  const closeEditor = () => setEdit(null);
  const save = (value: string | null) => {
    if (!edit) return;
    const store = scope === 'default' ? defaultStore : weekStore;
    const next = value === null && scope === 'date' ? null : value?.trim() || undefined;
    if (store.change({ key: scope === 'default' ? edit.defaultKey : edit.key,
      previous: scope === 'default' ? edit.defaultPrevious : edit.previous, value: next })) closeEditor();
  };
  return <>
    <p className="sr-only" role="status">{saving ? 'Saving…' : status}</p>
    {error && !edit && <p className="notice error" role="alert">{error}</p>}
    <div className="meal-grid" aria-label="Weekly meals">
      <div className="meal-grid-head" aria-hidden="true"><span />{mealSlots.map(slot => <span className="field-label" key={slot}>{slot}</span>)}</div>
      {weekDays(start).map(date => <section className="meal-day" key={dateKey(date)} aria-label={dayLabel(date)} aria-current={dateKey(date) === today ? 'date' : undefined}>
        <h3><span>{date.toLocaleDateString('en-GB', { weekday: 'long' })}</span><time dateTime={dateKey(date)}>{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</time>{dateKey(date) === today && <span className="today-marker">Today</span>}</h3>
        {mealSlots.map(slot => {
          const key = mealKey(date, slot);
          const meal = resolvedMeal(plan, defaults, date, slot);
          const defaultKey = defaultMealKey(date, slot);
          return <div className="meal-cell" key={slot}><button className="meal-slot" disabled={!token || !loaded} aria-label={`${dayLabel(date)}, ${slot}: ${meal.text || 'Not planned'}${meal.recurring ? ', weekly default' : ''}`}
            onClick={event => {
              selected.current = event.currentTarget;
              setEdit({ key, defaultKey, label: `${dayLabel(date)} · ${slot}`, repeatLabel: `Every ${weekdayNames[date.getDay()]} ${slot.toLowerCase()}`,
                previous: plan[key], defaultPrevious: defaults[defaultKey], text: meal.text });
              setScope('date'); setText(meal.text);
            }}>
            <span className="meal-slot-content"><span className="meal-slot-label field-label">{slot}</span><span className="meal-slot-text">{meal.text || <span className="unplanned">{token ? 'Add meal' : '—'}</span>}</span></span>
            {meal.recurring && <span className="meal-default-marker">Weekly default</span>}
          </button>
          {([{ store: weekStore, state: weekly, key, label: slot }, { store: defaultStore, state: recurring, key: defaultKey, label: `${slot} weekly default` }]).map(conflict =>
            conflict.state.conflicts.some(item => item.key === conflict.key) && <div className="item-conflict" key={conflict.key} role="group" aria-label={`Resolve ${dayLabel(date)} ${conflict.label}`}>
              <p>Someone else changed {conflict.label.toLowerCase()}.</p>
              <p>Yours: {conflict.state.value.meals[conflict.key] ?? (conflict.state.value.meals[conflict.key] === null ? 'Skipped' : 'Not set')}</p>
              <p>Family: {conflict.store.getRemote().meals[conflict.key] ?? (conflict.store.getRemote().meals[conflict.key] === null ? 'Skipped' : 'Not set')}</p>
              <div className="meal-actions"><button onClick={() => conflict.store.resolve(conflict.key, true)}>Keep mine</button>
                <button onClick={() => conflict.store.resolve(conflict.key, false)}>Use family change</button></div>
            </div>)}
          </div>;
        })}
      </section>)}
    </div>
    {edit && <form className="meal-editor" aria-label="Edit meal" onSubmit={event => { event.preventDefault(); void save(text); }}>
      {error && <p className="notice error" role="alert">{error}</p>}
      <label htmlFor="meal-text">{edit.label}</label>
      <textarea ref={editor} id="meal-text" rows={2} maxLength={300} value={text} disabled={!token} onChange={event => setText(event.target.value)} />
      <label className="meal-repeat" htmlFor="meal-scope">Apply to</label>
      <select id="meal-scope" value={scope} disabled={!token} onChange={event => setScope(event.target.value as 'date' | 'default')}>
        <option value="date">This date only</option><option value="default">{edit.repeatLabel}</option>
      </select>
      {scope === 'default' && <p>Used every week unless that date has its own meal or is skipped.
        {edit.previous !== undefined && ' This date has its own entry and will stay unchanged.'}</p>}
      <div className="meal-actions">
        <button type="submit" disabled={!token || !text.trim()}>Save</button>
        <button type="button" onClick={closeEditor}>Cancel</button>
        {scope === 'date' && edit.text && <button type="button" disabled={!token} onClick={() => void save(null)}>{edit.defaultPrevious ? 'Skip this meal' : 'Remove meal'}</button>}
        {scope === 'date' && edit.previous !== undefined && <button type="button" disabled={!token} onClick={() => void save('')}>Use weekly default</button>}
        {scope === 'default' && edit.defaultPrevious && <button type="button" disabled={!token} onClick={() => void save('')}>Remove weekly default</button>}
      </div>
    </form>}
    {!token && <p>To edit meals, connect in Settings.</p>}
  </>;
}
