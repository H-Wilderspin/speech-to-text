export function Icon({ name }: { name: 'back' | 'colour' | 'delete' }) {
  return <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {name === 'back' && <><path d="m9 5-7 7 7 7" /><path d="M2 12h13a6 6 0 0 1 6 6" /></>}
    {name === 'colour' && <><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 .7-2.8H17A4 4 0 0 0 21 11a9 9 0 0 0-9-8Z" /><circle cx="7" cy="10" r=".8" /><circle cx="11" cy="7" r=".8" /><circle cx="16" cy="9" r=".8" /></>}
    {name === 'delete' && <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>}
  </svg>;
}
