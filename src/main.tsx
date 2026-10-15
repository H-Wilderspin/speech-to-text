import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createBrowserEngine } from './transcription/browser';
import { removeRetiredData } from './app/retired-data';
import './app/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
void removeRetiredData(new URL(import.meta.env.BASE_URL, document.baseURI));
createRoot(root).render(<App engine={createBrowserEngine()} />);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Listening remains available when storage policy prevents offline installation.
      window.dispatchEvent(new Event('offline-install-failed'));
    });
  });
}
