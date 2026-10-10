import { createVoiceRecorder } from '../audio/recording';
import { EnrolmentSession } from '../features/speakers/enrolment';
import { WorkerEmbeddingEngine } from '../identification/worker-engine';
import { IndexedDbProfiles } from '../storage/indexeddb';

export function createSpeakerServices() {
  const appUrl = new URL(import.meta.env.BASE_URL, document.baseURI);
  const store = new IndexedDbProfiles(`speech-to-text-speakers:${appUrl.pathname}`);
  const engine = new WorkerEmbeddingEngine(new URL('speaker/v1/', appUrl).href);
  const session = new EnrolmentSession(createVoiceRecorder(), engine, store);
  return { store, session };
}
