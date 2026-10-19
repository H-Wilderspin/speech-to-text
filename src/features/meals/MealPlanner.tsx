import { useEffect, useRef, useState } from 'react';
import { dateKey, defaultMealKey, mealKey, mealSlots, resolvedMeal, weekdayNames, weekDays, type MealPlan, type MealValue } from './calendar';
import { PlanConflict, readDefaults, readPlan, saveDefault, saveMeal } from './github-plan';
const dayLabel = (date: Date) => date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Try again.';

export function MealWeek({ start, today, token, refresh, onBusy, active }: {
  active: boolean; start: Date; today: string; token: string; refresh: number; onBusy: (busy: boolean) => void;
}) {
  const week = dateKey(start);
  const [plan, setPlan] = useState<MealPlan>({});
  const [defaults, setDefaults] = useState<MealPlan>({});
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('Loading plan…');
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<{
    key: string; defaultKey: string; label: string; repeatLabel: string;
    previous: MealValue; defaultPrevious: MealValue; text: string;
  } | null>(null);
  const [scope, setScope] = useState<'date' | 'default'>('date');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const selected = useRef<HTMLButtonElement | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const generation = useRef(0);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    const load = async () => {
      if (document.hidden || savingRef.current) return;
      const current = ++generation.current;
      try {
        const [next, nextDefaults] = await Promise.all([readPlan(week, token), readDefaults(token)]);
        if (disposed || current !== generation.current) return;
        setPlan(next); setDefaults(nextDefaults); setLoaded(true); setError('');
        setStatus('Plan updated');
      } catch (error) {
        if (!disposed && current === generation.current) {
          setStatus('Could not refresh plan'); setError(errorMessage(error));
        }
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 60000);
    const focus = () => void load();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      disposed = true; clearInterval(interval); window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, [week, refresh, token, active]);

  useEffect(() => { if (active && edit) editor.current?.focus(); }, [edit, active]);
  useEffect(() => {
    if (active && !edit && !saving && selected.current && !selected.current.disabled) {
      selected.current.focus(); selected.current = null;
    }
  }, [edit, saving, active]);
  const closeEditor = () => setEdit(null);
  const save = async (value: string | null) => {
    if (!edit || savingRef.current) return;
    generation.current += 1;
    savingRef.current = true;
    setSaving(true); onBusy(true); setError('');
    try {
      if (scope === 'default') {
        const next = await saveDefault(edit.defaultKey, edit.defaultPrevious, value ?? '', token);
        setDefaults(next); setStatus(value ? 'Weekly default saved' : 'Weekly default removed');
      } else {
        const next = await saveMeal(week, edit.key, edit.previous, value, token);
        setPlan(next); setStatus(value === null ? 'Meal skipped for this date' : value ? 'Meal saved' : 'Weekly default restored');
      }
      closeEditor();
    } catch (error) {
      if (error instanceof PlanConflict) {
        if (error.scope === 'defaults') setDefaults(error.latest); else setPlan(error.latest);
      }
      setError(errorMessage(error));
    }
    finally { savingRef.current = false; setSaving(false); onBusy(false); }
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
          return <button className="meal-slot" key={slot} disabled={!token || !loaded || saving} aria-label={`${dayLabel(date)}, ${slot}: ${meal.text || 'Not planned'}${meal.recurring ? ', weekly default' : ''}`}
            onClick={event => {
              selected.current = event.currentTarget;
              setEdit({ key, defaultKey, label: `${dayLabel(date)} · ${slot}`, repeatLabel: `Every ${weekdayNames[date.getDay()]} ${slot.toLowerCase()}`,
                previous: plan[key], defaultPrevious: defaults[defaultKey], text: meal.text });
              setScope('date'); setText(meal.text); setError('');
            }}>
            <span className="meal-slot-label field-label">{slot}</span><span>{meal.text || <span className="unplanned">{token ? 'Add meal' : '—'}</span>}</span>
            {meal.recurring && <span className="meal-default-marker">Weekly default</span>}
          </button>;
        })}
      </section>)}
    </div>
    {edit && <form className="meal-editor" aria-label="Edit meal" onSubmit={event => { event.preventDefault(); void save(text); }}>
      {error && <p className="notice error" role="alert">{error}</p>}
      <label htmlFor="meal-text">{edit.label}</label>
      <textarea ref={editor} id="meal-text" rows={2} maxLength={300} value={text} disabled={saving} onChange={event => setText(event.target.value)} />
      <label className="meal-repeat" htmlFor="meal-scope">Apply to</label>
      <select id="meal-scope" value={scope} disabled={saving} onChange={event => setScope(event.target.value as 'date' | 'default')}>
        <option value="date">This date only</option><option value="default">{edit.repeatLabel}</option>
      </select>
      {scope === 'default' && <p>Used every week unless that date has its own meal or is skipped.
        {edit.previous !== undefined && ' This date has its own entry and will stay unchanged.'}</p>}
      <div className="meal-actions">
        <button type="submit" disabled={saving || !text.trim()}>Save</button>
        <button type="button" disabled={saving} onClick={closeEditor}>Cancel</button>
        {scope === 'date' && edit.text && <button type="button" disabled={saving} onClick={() => void save(null)}>{edit.defaultPrevious ? 'Skip this meal' : 'Remove meal'}</button>}
        {scope === 'date' && edit.previous !== undefined && <button type="button" disabled={saving} onClick={() => void save('')}>Use weekly default</button>}
        {scope === 'default' && edit.defaultPrevious && <button type="button" disabled={saving} onClick={() => void save('')}>Remove weekly default</button>}
      </div>
    </form>}
    {!token && <p>To edit meals, connect GitHub in Settings.</p>}
  </>;
}
