export function Icon({ name = 'back' }: { name?: 'back' | 'clear' | 'settings' | 'meals' | 'tasks' | 'edit' | 'previous' | 'next' | 'refresh' | 'split-vertical' | 'split-horizontal' }) {
  return <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {name === 'back' && <><path d="m9 5-7 7 7 7" /><path d="M2 12h13a6 6 0 0 1 6 6" /></>}
    {name === 'clear' && <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>}
    {name === 'settings' && <><path d="M10 2h4l.5 3 1.5 1 3-1 2 3-2 2v4l2 2-2 3-3-1-1.5 1-.5 3h-4l-.5-3-1.5-1-3 1-2-3 2-2v-4L3 8l2-3 3 1 1.5-1Z" /><circle cx="12" cy="12" r="3" /></>}
    {name === 'meals' && <><path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M20 3c-5 0-5 10 0 10V3Zm0 10v8" /></>}
    {name === 'previous' && <path d="m15 5-7 7 7 7" />}
    {name === 'next' && <path d="m9 5 7 7-7 7" />}
    {name === 'tasks' && <><path d="m3 6 2 2 4-4M12 6h9M3 13l2 2 4-4M12 13h9M3 20h6M12 20h9" /></>}
    {name === 'edit' && <><path d="m4 16-1 5 5-1L21 7l-4-4L4 16ZM14 6l4 4" /></>}
    {name === 'split-vertical' && <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 3v18" /></>}
    {name === 'split-horizontal' && <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 12h18" /></>}
    {name === 'refresh' && <><path d="M22 4v6h-6M2 20v-6h6" /><path d="M3.5 9a9 9 0 0 1 14.9-3.4L22 10M2 14l3.6 4.4A9 9 0 0 0 20.5 15" /></>}
  </svg>;
}
