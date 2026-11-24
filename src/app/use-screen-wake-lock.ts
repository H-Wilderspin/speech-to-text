import { useEffect, useState } from 'react';
import { watchScreenWakeLock, type WakeStatus } from './screen-wake-lock';

export function useScreenWakeLock(): WakeStatus {
  const [status, setStatus] = useState<WakeStatus>('idle');
  useEffect(() => watchScreenWakeLock(setStatus), []);
  return status;
}
