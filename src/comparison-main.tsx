import { createRoot } from 'react-dom/client';
import { ComparisonApp } from './features/comparison/ComparisonApp';
import { createBrowserEngine } from './transcription/browser';
import { RemoteNames } from './transcription/remote/engine';
import { IndexedDbProfiles } from './storage/indexeddb';
import './app/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
const appUrl = new URL(import.meta.env.BASE_URL, document.baseURI);
const database = `speech-to-text-speakers:${appUrl.pathname}`;
createRoot(root).render(<ComparisonApp browser={createBrowserEngine()} remote={new RemoteNames(() => new IndexedDbProfiles(database))} database={database} />);
