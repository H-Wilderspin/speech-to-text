export function Icon({ name }: { name: 'clear' | 'captions' | 'settings' | 'meals' | 'shopping' | 'edit' | 'previous' | 'next' | 'refresh' | 'split' }) {
  return <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {name === 'clear' && <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>}
    {name === 'captions' && <><path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-6 4V5a2 2 0 0 1 2-2Z" /><path d="M7 8h10M7 12h7" /></>}
    {name === 'settings' && <><path d="M10 2h4l.5 3 1.5 1 3-1 2 3-2 2v4l2 2-2 3-3-1-1.5 1-.5 3h-4l-.5-3-1.5-1-3 1-2-3 2-2v-4L3 8l2-3 3 1 1.5-1Z" /><circle cx="12" cy="12" r="3" /></>}
    {name === 'meals' && <><path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M20 3c-5 0-5 10 0 10V3Zm0 10v8" /></>}
    {name === 'previous' && <path d="m15 5-7 7 7 7" />}
    {name === 'next' && <path d="m9 5 7 7-7 7" />}
    {name === 'shopping' && <><path d="M2 3h3l3 12h11l3-8H6M8 15l-1 3h12" /><circle cx="9" cy="21" r="1" /><circle cx="18" cy="21" r="1" /></>}
    {name === 'edit' && <><path d="m4 16-1 5 5-1L21 7l-4-4L4 16ZM14 6l4 4" /></>}
    {name === 'split' && <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 3v18" /></>}
    {name === 'refresh' && <><path d="M22 4v6h-6M2 20v-6h6" /><path d="M3.5 9a9 9 0 0 1 14.9-3.4L22 10M2 14l3.6 4.4A9 9 0 0 0 20.5 15" /></>}
  </svg>;
}
