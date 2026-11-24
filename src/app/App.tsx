import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { watchInterruptions } from '../audio/interruption';
import { Transcript } from '../features/listening/Transcript';
import { ListeningIndicator } from '../features/listening/ListeningIndicator';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import type { TranscriptionEngine } from '../transcription/types';
import { readPreferences, savePreferences } from '../features/settings/preferences';
import { useListeningWakeLock } from './use-listening-wake-lock';
import { Icon } from '../shared/Icon';
import { Planner, type PlannerKind } from '../features/planners/Planner';
import { usePlannerLayout } from '../features/planners/use-planner-layout';
import { useMealAccess } from '../features/meals/use-meal-access';
import { PlannerSync } from '../features/planners/planner-sync';

export function App({ engine }: { engine: TranscriptionEngine }) {
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const wakeStatus = useListeningWakeLock(engine);
  const [preferences, setPreferences] = useState(readPreferences);
  const { textSize, language } = preferences;
  const changePreferences = (changes: Partial<typeof preferences>) => {
    setPreferences((current) => { const next = { ...current, ...changes }; savePreferences(next); return next; });
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [updating, setUpdating] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const mealButton = useRef<HTMLButtonElement>(null);
  const shoppingButton = useRef<HTMLButtonElement>(null);
  const plannerButton = (kind: PlannerKind) => kind === 'meals' ? mealButton : shoppingButton;
  const [planner, setPlanner] = useState<PlannerKind | null>(null);
  const [refresh, setRefresh] = useState(0);
  const refreshPlanners = useCallback(() => setRefresh(value => value + 1), []);
  const [plannerBusy, setPlannerBusy] = useState(false);
  const { access: mealAccess, connect: connectMeals, onAccessError, needsToken } = useMealAccess();
  const [sync] = useState(() => new PlannerSync());
  const syncState = useSyncExternalStore(sync.subscribe, sync.getSnapshot);
  useEffect(() => { sync.start(); return () => sync.stop(); }, [sync]);
  useEffect(() => { sync.configure(mealAccess.token, onAccessError); }, [sync, mealAccess.token, onAccessError]);
  const navigating = useRef(false);
  const plannerFocus = useRef<HTMLButtonElement | null>(null);
  const { layout: plannerLayout, setLayout: setPlannerLayout, splitAvailable } = usePlannerLayout();
  const panelOpen = settingsOpen || Boolean(planner);
  const captionsVisible = !panelOpen || plannerLayout === 'split';
  const navigatePlanner = async (next: PlannerKind | null, showSettings = false, focusTarget: HTMLButtonElement | null = null) => {
    if (plannerBusy || settingsBusy || navigating.current) return;
    navigating.current = true;
    try {
      await sync.navigate();
      const focusKind = next ?? planner;
      plannerFocus.current = focusTarget ?? (focusKind ? plannerButton(focusKind).current : settingsButton.current);
      setPlanner(next);
      setSettingsOpen(showSettings);
    } finally { navigating.current = false; }
  };
  const togglePlanner = (next: PlannerKind) => void navigatePlanner(planner === next && !settingsOpen ? null : next);
  useEffect(() => {
    if (plannerBusy || settingsBusy || !plannerFocus.current) return;
    plannerFocus.current.focus({ preventScroll: true });
    plannerFocus.current = null;
  }, [planner, plannerBusy, settingsOpen, settingsBusy]);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [installFailed, setInstallFailed] = useState(false);
  const active = ['requesting-permission', 'listening', 'restarting', 'stopping'].includes(snapshot.phase);

  useEffect(() => {
    const unwatch = watchInterruptions(() => engine.interrupt());
    const updateNetwork = () => setOffline(!navigator.onLine);
    const installationError = () => setInstallFailed(true);
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    window.addEventListener('offline-install-failed', installationError);
    return () => {
      unwatch();
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
      window.removeEventListener('offline-install-failed', installationError);
      engine.dispose();
    };
  }, [engine]);

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <h1 className="sr-only">Speech to Text</h1>
    <main id="main-content" tabIndex={-1} className={panelOpen && plannerLayout === 'split' ? 'content-layout with-meals' : 'content-layout'}>
    <section id="captions" className="caption-panel" hidden={!captionsVisible}>
      <p className={snapshot.phase === 'error' ? 'notice error' : 'sr-only'} role="status" aria-live="polite" aria-atomic="true">{active ? '' : snapshot.message}</p>
      {engine.unavailableReason && <p className="notice" role="alert">{engine.unavailableReason}</p>}
      {offline && <p className="notice">You’re offline. Your browser’s speech service may need a connection.</p>}
      <Transcript visible={captionsVisible} segments={snapshot.segments} textSize={textSize} language={language} />
    </section>
    {planner && <Planner client={sync} visible={!settingsOpen} kind={planner} token={mealAccess.token} layout={plannerLayout} refresh={refresh} onRefresh={refreshPlanners} busy={plannerBusy} onBusy={setPlannerBusy} />}
    {settingsOpen && <SettingsPanel active={active} beforeUpdate={() => sync.safeToLeave()} textSize={textSize} onTextSize={(textSize) => changePreferences({ textSize })}
      language={language} onLanguage={(language) => changePreferences({ language })} installFailed={installFailed} wakeStatus={wakeStatus}
      mealAccess={mealAccess} onMealToken={connectMeals} needsToken={needsToken} onAccessError={onAccessError}
      onBusy={setSettingsBusy} onUpdating={setUpdating} />}
    </main>
    <footer className={splitAvailable ? "toolbar has-split" : "toolbar"} aria-label="App controls">
      <ListeningIndicator phase={snapshot.phase} />
      <button className={active ? 'listen is-active' : 'listen'} disabled={updating || Boolean(engine.unavailableReason) || snapshot.phase === 'stopping'}
        aria-describedby="processing-note" onClick={() => active ? engine.stop() : engine.start(language)}>
        {snapshot.phase === 'stopping' ? 'Stopping…' : active ? 'Stop' : 'Listen'}
      </button>
      <button className="icon-button" aria-label="Clear" title="Clear captions" disabled={updating || snapshot.segments.length === 0} onClick={() => engine.clear()}><Icon name="clear" /></button>
      <button className="icon-button" aria-label="Speech to text" title="Speech to text" aria-controls="captions" aria-expanded={!planner && !settingsOpen}
        disabled={plannerBusy || settingsBusy} onClick={event => void navigatePlanner(null, false, event.currentTarget)}><Icon name="captions" /></button>
      <button className="icon-button" aria-label="Meal planner" title="Meal planner" aria-controls="planner-panel" aria-expanded={!settingsOpen && planner === 'meals'} disabled={plannerBusy || settingsBusy} ref={mealButton} onClick={() => togglePlanner('meals')}><Icon name="meals" /></button>
      <button className="icon-button" aria-label="Shopping list" title="Shopping list" aria-controls="planner-panel" aria-expanded={!settingsOpen && planner === 'shopping'} disabled={plannerBusy || settingsBusy} ref={shoppingButton} onClick={() => togglePlanner('shopping')}><Icon name="shopping" /></button>
      <button className="icon-button desktop-refresh" aria-label="Refresh" title="Refresh meals and shopping" disabled={!planner || plannerBusy || settingsBusy} onClick={refreshPlanners}><Icon name="refresh" /><span className="sync-dot" data-state={syncState.conflict ? 'conflict' : syncState.saving ? 'saving' : syncState.pending ? 'pending' : 'saved'} aria-hidden="true" /></button>
      <span className="sr-only" role="status">{!syncState.durable ? 'Changes not yet saved on this device' : syncState.conflict ? 'Family changes need review' : syncState.saving ? 'Saving changes' : syncState.pending ? 'Changes kept on this device, waiting to sync' : 'All changes saved'}</span>
      {splitAvailable && <button className="icon-button split-button" aria-label="Split view" aria-pressed={plannerLayout === 'split'}
        title={plannerLayout === 'split' ? 'Turn split view off' : 'Show captions on the left'} disabled={!panelOpen || plannerBusy || settingsBusy}
        onClick={event => { event.currentTarget.focus(); setPlannerLayout(plannerLayout === 'split' ? 'full' : 'split'); }}><Icon name="split" /></button>}
      <button className="icon-button" aria-label="Settings" title="Settings" aria-controls="settings-panel" aria-expanded={settingsOpen} disabled={plannerBusy || settingsBusy} ref={settingsButton} onClick={() => void navigatePlanner(settingsOpen ? null : planner, !settingsOpen, settingsButton.current)}><Icon name="settings" /></button>
    </footer>
    <p className="sr-only" id="processing-note">Listen uses your browser’s speech service, which may send audio to its provider. Captions are kept only until you clear or reload. Details are in Settings.</p>

  </div>;
}
