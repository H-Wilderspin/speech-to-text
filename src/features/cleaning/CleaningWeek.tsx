import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/Icon';
import { dateKey, weekdayNames, weekDays } from '../meals/calendar';
import { CleaningConflict, readCleaningPlan, saveCleaningChange, syncCleaningWeek, type CleaningChange } from './github-cleaning';
import { cleaningDayLabel, emptyCleaningPlan, recurringTaskKey, tasksForDay } from './tasks';

export function CleaningWeek({ start, today, token, refresh, onBusy, active }: {
  start: Date; today: string; token: string; refresh: number; onBusy: (busy: boolean) => void; active: boolean;
}) {
  const week = dateKey(start);
  const [plan, setPlan] = useState(emptyCleaningPlan);
  const [defaults, setDefaults] = useState(emptyCleaningPlan);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('Loading task plan…');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<{
    key: string; defaultKey: string; label: string; repeatLabel: string; existing: boolean;
    previous: string | null | undefined; defaultPrevious: string | null | undefined;
  } | null>(null);
  const [text, setText] = useState('');
  const [scope, setScope] = useState<'date' | 'default'>('date');
  const editor = useRef<HTMLTextAreaElement>(null);
  const selected = useRef<HTMLElement | null>(null);
  const focusDay = useRef(week);
  const savingRef = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    const load = async () => {
      if (document.hidden || savingRef.current) return;
      const current = ++generation.current;
      try {
        const [next, recurring] = await Promise.all([syncCleaningWeek(week, token), readCleaningPlan(undefined, token)]);
        if (disposed || current !== generation.current) return;
        setPlan(next); setDefaults(recurring); setLoaded(true); setError(''); setStatus('Task plan updated');
      } catch (error) {
        if (!disposed && current === generation.current) {
          setStatus('Could not refresh task plan'); setError(error instanceof Error ? error.message : 'Could not load tasks. Try again.');
        }
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    const focus = () => void load();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      disposed = true; clearInterval(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus);
    };
  }, [active, week, refresh, token, today]);

  useEffect(() => { if (active && edit) editor.current?.focus(); }, [active, edit]);
  useEffect(() => {
    if (active && !edit && !saving && selected.current) {
      const target = selected.current.isConnected ? selected.current : document.getElementById(`cleaning-add-${focusDay.current}`);
      target?.focus(); selected.current = null;
    }
  }, [active, edit, saving]);

  const commit = async (change: CleaningChange, recurring = false, finishEditing = false) => {
    if (savingRef.current) return;
    generation.current++; savingRef.current = true; setSaving(true); onBusy(true); setError('');
    try {
      const next = await saveCleaningChange(recurring ? undefined : week, change, token);
      if (recurring) setDefaults(next); else setPlan(next);
      setStatus(change.field === 'completed' ? (change.value ? 'Task marked complete' : 'Task marked incomplete') : 'Task saved');
      if (finishEditing) setEdit(null);
    } catch (error) {
      if (error instanceof CleaningConflict) {
        if (error.scope === 'defaults') setDefaults(error.latest); else setPlan(error.latest);
      }
      setError(error instanceof Error ? error.message : 'Could not save the task. Try again.');
    } finally { savingRef.current = false; setSaving(false); onBusy(false); }
  };
  const save = (value: string | null | undefined) => {
    if (!edit) return;
    void commit({ field: 'tasks', key: scope === 'default' ? edit.defaultKey : edit.key,
      previous: scope === 'default' ? edit.defaultPrevious : edit.previous, value }, scope === 'default', true);
  };
  const beginEdit = (date: Date, id: string, text: string, existing: boolean, button: HTMLButtonElement) => {
    const key = `${dateKey(date)}/${id}`;
    const defaultKey = recurringTaskKey(date, id);
    selected.current = button; focusDay.current = dateKey(date);
    setEdit({ key, defaultKey, label: cleaningDayLabel(date), repeatLabel: `Every ${weekdayNames[date.getDay()]}`,
      previous: plan.tasks[key], defaultPrevious: defaults.tasks[defaultKey], existing });
    setText(text); setScope('date'); setError('');
  };
  const disabled = !token || !loaded || saving;
  return <>
    <p className="sr-only" role="status">{saving ? 'Saving…' : status}</p>
    {error && !edit && <p className="notice error" role="alert">{error}</p>}
    <div className="cleaning-days">
      {weekDays(start).map(date => {
        const day = dateKey(date);
        const tasks = tasksForDay(plan, defaults, date);
        return <section className="cleaning-day" key={day} aria-label={cleaningDayLabel(date)} aria-current={day === today ? 'date' : undefined}>
          <h3>{cleaningDayLabel(date)} {day === today && <span className="today-marker">Today</span>}</h3>
          {tasks.length === 0 && <p className="unplanned">No tasks planned</p>}
          {tasks.map(task => <div className="cleaning-task" key={task.id}>
            {task.skipped ? <div className="cleaning-task-label"><span>{task.text}</span><span className="unplanned">Skipped this date</span></div>
              : <label className="cleaning-task-label"><input type="checkbox" checked={task.done} disabled={disabled || Boolean(edit)}
                aria-label={`Complete ${task.text} on ${cleaningDayLabel(date)}`} onChange={event => {
                  selected.current = event.currentTarget; focusDay.current = day;
                  void commit({ field: 'completed', key: task.key, previous: plan.completed[task.key], value: event.target.checked });
                }} /><span className={task.done ? 'cleaning-done' : ''}>{task.text}
                  {task.recurring && <span className="meal-default-marker">Weekly task</span>}</span></label>}
            {task.skipped ? <button disabled={disabled} onClick={event => {
              selected.current = event.currentTarget; focusDay.current = day;
              void commit({ field: 'tasks', key: task.key, previous: null, value: undefined });
            }}>Restore task</button> : <button className="icon-button" disabled={disabled} aria-label={`Edit ${task.text} on ${cleaningDayLabel(date)}`}
              onClick={event => beginEdit(date, task.id, task.text, true, event.currentTarget)}><Icon name="edit" /></button>}
          </div>)}
          <button className="cleaning-add" id={`cleaning-add-${day}`} disabled={disabled} aria-label={`Add task for ${cleaningDayLabel(date)}`}
            onClick={event => beginEdit(date, crypto.randomUUID(), '', false, event.currentTarget)}>Add task</button>
        </section>;
      })}
    </div>
    {edit && <form className="meal-editor cleaning-editor" aria-label="Edit task" onSubmit={event => { event.preventDefault(); save(text); }}>
      {error && <p className="notice error" role="alert">{error}</p>}
      <p>{edit.label}</p>
      <label htmlFor="cleaning-text">Task</label>
      <textarea id="cleaning-text" ref={editor} rows={2} maxLength={300} value={text} disabled={saving} onChange={event => setText(event.target.value)} />
      <label htmlFor="cleaning-scope">Apply to</label>
      <select id="cleaning-scope" value={scope} disabled={saving} onChange={event => setScope(event.target.value as 'date' | 'default')}>
        <option value="date">This date only</option><option value="default">{edit.repeatLabel}</option>
      </select>
      {scope === 'default' && <p>Repeats weekly. Each date has its own completion tick.
        {edit.previous !== undefined && ' This date has its own entry and will stay unchanged.'}</p>}
      <div className="meal-actions">
        <button type="submit" disabled={saving || !token || !text.trim()}>Save</button>
        <button type="button" disabled={saving} onClick={() => setEdit(null)}>Cancel</button>
        {scope === 'date' && edit.existing && <button type="button" disabled={saving || !token} onClick={() => save(edit.defaultPrevious ? null : undefined)}>{edit.defaultPrevious ? 'Skip this task' : 'Remove task'}</button>}
        {scope === 'date' && edit.previous !== undefined && edit.defaultPrevious && <button type="button" disabled={saving || !token} onClick={() => save(undefined)}>Use weekly task</button>}
        {scope === 'default' && edit.defaultPrevious && <button type="button" disabled={saving || !token} onClick={() => save(undefined)}>Remove weekly task</button>}
      </div>
    </form>}
    <p>Completion ticks reset once on Sunday. Tasks stay on the list.</p>
    {!token && <p>To edit or tick off tasks, connect GitHub in Settings.</p>}
  </>;
}
