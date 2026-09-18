export default function ReaderIcon({ name }) {
  const paths = {
    previous: <path d="m14 6-6 6 6 6" />,
    next: <path d="m10 6 6 6-6 6" />,
    minus: <path d="M5 12h14" />,
    plus: <path d="M5 12h14M12 5v14" />,
    expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    link: <><path d="m10 13 4-4m-5 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    external: <path d="M14 3h7v7m0-7L10 14m-1-9H4v15h15v-5" />,
    check: <path d="m5 12 4 4L19 6" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    filter: <><path d="M3 6h18M3 12h18M3 18h18" /><path d="M8 3v6m8 0v6m-9 0v6" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.5" /></>,
    grid: <><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="3" width="6" height="6" rx="1" /><rect x="3" y="15" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /></>,
    layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />,
  }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
