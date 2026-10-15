import { useEffect, useState } from 'react';
import type { TranscriptionEngine } from '../transcription/types';
import { watchListeningWakeLock, type WakeStatus } from './listening-wake-lock';

export function useListeningWakeLock(engine: TranscriptionEngine): WakeStatus {
  const [status, setStatus] = useState<WakeStatus>('idle');
  useEffect(() => watchListeningWakeLock(engine, setStatus), [engine]);
  return status;
}
