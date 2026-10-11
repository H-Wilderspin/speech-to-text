import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createSpeakerServices } from './app/speaker-services';
import { createBrowserEngine } from './transcription/browser';
import { LocalEngine } from './transcription/local/engine';
import { DelayedNamesEngine } from './transcription/delayed/engine';
import { IndexedDbProfiles } from './storage/indexeddb';
import './app/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
const appUrl = new URL(import.meta.env.BASE_URL, document.baseURI);
const localEngine = new DelayedNamesEngine(createBrowserEngine(), new LocalEngine(appUrl.href,
  () => new IndexedDbProfiles(`speech-to-text-speakers:${appUrl.pathname}`), undefined, undefined, undefined, false));
createRoot(root).render(<App engine={createBrowserEngine()} localEngine={localEngine} createSpeakers={createSpeakerServices} />);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Listening remains available when storage policy prevents offline installation.
      window.dispatchEvent(new Event('offline-install-failed'));
    });
  });
}
