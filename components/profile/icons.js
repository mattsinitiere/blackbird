/** Compact outline icons for the profile, sized in em so they track text size. */
function Svg({ children, size = "1.05em" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function PinIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}

export function CalendarIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </Svg>
  );
}

export function ShareIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 15V3" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </Svg>
  );
}

export function EditIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </Svg>
  );
}

export function ChevronIcon(props) {
  return (
    <Svg {...props}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

/** Small title-case action button with a chevron, used across the profile. */
export function ActionLink({ onClick, children, className = "" }) {
  return (
    <button type="button" className={`pf-action-link ${className}`.trim()} onClick={onClick}>
      <span>{children}</span>
      <span className="pf-action-link-go" aria-hidden="true">
        <ChevronIcon size="0.85em" />
      </span>
    </button>
  );
}
