import { useCallback, useEffect, useState } from 'react';
import { changeMealAccess, editorTokenKey, readMealAccess } from './editor-token';

export function useMealAccess() {
  const [access, setAccess] = useState(readMealAccess);
  const [failedToken, setFailedToken] = useState('');
  const onAccessError = useCallback((token: string) => setFailedToken(token), []);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      // Forgetting access in another tab also disconnects this tab. No stored
      // value is copied back to disk, so a stale tab cannot resurrect a token.
      if (event.storageArea === window.localStorage && (event.key === null || event.key === editorTokenKey())) setAccess(readMealAccess());
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  const connect = (token: string) => { setAccess(changeMealAccess(token)); setFailedToken(''); };
  return { access, connect, onAccessError, needsToken: Boolean(access.token && access.token === failedToken) };
}
