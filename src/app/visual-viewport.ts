// A keyboard can resize or pan only the visible viewport, leaving vh/dvh intact.
// Follow both events rather than assuming every keyboard resizes the page.
export function watchVisualViewport(root: HTMLElement): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  let frame = 0;
  const update = () => {
    frame = 0;
    // Preserve the unzoomed layout while the user pinches and pans to read it.
    if (viewport.scale !== 1 || viewport.height <= 0) return;
    root.style.setProperty('--visible-height', `${viewport.height}px`);
    root.style.setProperty('--visible-top', `${viewport.offsetTop}px`);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  update();
  viewport.addEventListener('resize', schedule);
  viewport.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', schedule);
  return () => {
    cancelAnimationFrame(frame);
    viewport.removeEventListener('resize', schedule);
    viewport.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('pageshow', schedule);
    document.removeEventListener('visibilitychange', schedule);
    root.style.removeProperty('--visible-height');
    root.style.removeProperty('--visible-top');
  };
}
