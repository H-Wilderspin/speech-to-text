import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { watchInterruptions } from '../audio/interruption';
import { Transcript } from '../features/listening/Transcript';
import { ListeningIndicator } from '../features/listening/ListeningIndicator';
import { SettingsDialog } from '../features/settings/SettingsDialog';
import type { TranscriptionEngine } from '../transcription/types';
import { readPreferences, savePreferences } from '../features/settings/preferences';
import { useListeningWakeLock } from './use-listening-wake-lock';
import { Icon } from '../shared/Icon';
import { Planner, type PlannerKind } from '../features/planners/Planner';
import { usePlannerLayout } from '../features/planners/use-planner-layout';
import { useMealAccess } from '../features/meals/use-meal-access';
import type { ShoppingHandle } from '../features/shopping/use-shopping-sync';

export function App({ engine }: { engine: TranscriptionEngine }) {
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const wakeStatus = useListeningWakeLock(engine);
  const [preferences, setPreferences] = useState(readPreferences);
  const { textSize, language } = preferences;
  const changePreferences = (changes: Partial<typeof preferences>) => {
    setPreferences((current) => { const next = { ...current, ...changes }; savePreferences(next); return next; });
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const mealButton = useRef<HTMLButtonElement>(null);
  const cleaningButton = useRef<HTMLButtonElement>(null);
  const shoppingButton = useRef<HTMLButtonElement>(null);
  const plannerButton = (kind: PlannerKind) => kind === 'meals' ? mealButton : kind === 'cleaning' ? cleaningButton : shoppingButton;
  const [planner, setPlanner] = useState<PlannerKind | null>(null);
  const [plannerBusy, setPlannerBusy] = useState(false);
  const shopping = useRef<ShoppingHandle>(null);
  const navigating = useRef(false);
  const plannerFocus = useRef<HTMLButtonElement | null>(null);
  const { layout: plannerLayout, setLayout: setPlannerLayout, verticalSplitAvailable } = usePlannerLayout();
  const navigatePlanner = async (next: PlannerKind | null) => {
    if (plannerBusy || navigating.current) return;
    navigating.current = true;
    try {
      if (shopping.current && !await shopping.current.flush()) return;
      const focusKind = next ?? planner;
      if (focusKind) plannerFocus.current = plannerButton(focusKind).current;
      setPlanner(next);
    } finally { navigating.current = false; }
  };
  const togglePlanner = (next: PlannerKind) => void navigatePlanner(planner === next && plannerLayout !== 'full' ? null : next);
  useEffect(() => {
    if (plannerBusy || !plannerFocus.current) return;
    if (!planner || plannerLayout !== 'full') plannerFocus.current.focus();
    plannerFocus.current = null;
  }, [planner, plannerBusy, plannerLayout]);
  const { access: mealAccess, connect: connectMeals } = useMealAccess();
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
    <a className="skip-link" href="#captions">Skip to captions</a>
    <h1 className="sr-only">Speech to Text</h1>
    <div className={planner && plannerLayout !== 'full' ? `content-layout with-meals split-${plannerLayout}` : 'content-layout'}>
    <main id="captions">
      <p className={snapshot.phase === 'error' ? 'notice error' : 'sr-only'} role="status" aria-live="polite" aria-atomic="true">{active ? '' : snapshot.message}</p>
      {engine.unavailableReason && <p className="notice" role="alert">{engine.unavailableReason}</p>}
      {offline && <p className="notice">You’re offline. Your browser’s speech service may need a connection.</p>}
      <Transcript segments={snapshot.segments} textSize={textSize} language={language} />
    </main>
    {planner && <Planner kind={planner} token={mealAccess.token} layout={plannerLayout} onLayout={setPlannerLayout} verticalSplitAvailable={verticalSplitAvailable} busy={plannerBusy} onBusy={setPlannerBusy} shoppingRef={shopping}
      onClose={() => void navigatePlanner(null)} />}
    </div>
    <footer className="toolbar" aria-label="Caption controls">
      <ListeningIndicator phase={snapshot.phase} />
      <button className={active ? 'listen is-active' : 'listen'} disabled={Boolean(engine.unavailableReason) || snapshot.phase === 'stopping'}
        aria-describedby="processing-note" onClick={() => active ? engine.stop() : engine.start(language)}>
        {snapshot.phase === 'stopping' ? 'Stopping…' : active ? 'Stop' : 'Listen'}
      </button>
      <button className="icon-button" aria-label="Clear" title="Clear captions" disabled={snapshot.segments.length === 0} onClick={() => engine.clear()}><Icon name="clear" /></button>
      <button className="icon-button" aria-label="Meal planner" title="Meal planner" aria-expanded={planner === 'meals'} disabled={plannerBusy} ref={mealButton} onClick={() => togglePlanner('meals')}><Icon name="meals" /></button>
      <button className="icon-button" aria-label="Task planner" title="Task planner" aria-expanded={planner === 'cleaning'} disabled={plannerBusy} ref={cleaningButton} onClick={() => togglePlanner('cleaning')}><Icon name="tasks" /></button>
      <button className="icon-button" aria-label="Shopping list" title="Shopping list" aria-expanded={planner === 'shopping'} disabled={plannerBusy} ref={shoppingButton} onClick={() => togglePlanner('shopping')}><Icon name="shopping" /></button>
      <button className="icon-button" aria-label="Settings" title="Settings" ref={settingsButton} onClick={() => setSettingsOpen(true)}><Icon name="settings" /></button>
    </footer>
    <p className="sr-only" id="processing-note">Listen uses your browser’s speech service, which may send audio to its provider. Captions are kept only until you clear or reload. Details are in Settings.</p>
    {settingsOpen && <SettingsDialog active={active} plannerOpen={planner !== null} textSize={textSize} onTextSize={(textSize) => changePreferences({ textSize })}
      language={language} onLanguage={(language) => changePreferences({ language })} installFailed={installFailed} wakeStatus={wakeStatus}
      mealAccess={mealAccess} onMealToken={connectMeals}
      onClose={() => { setSettingsOpen(false); settingsButton.current?.focus(); }} />}
  </div>;
}
