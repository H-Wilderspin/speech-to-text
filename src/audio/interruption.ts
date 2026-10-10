/** Recognition owns its capture; never open a second microphone merely to test permission. */
export function watchInterruptions(interrupt: () => void): () => void {
  const onVisibility = () => { if (document.hidden) interrupt(); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', interrupt);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', interrupt);
  };
}
