// Simple, clean line icons for the sidebar rail. Hand-authored to visually
// match the source design (thin-line, rounded style) since the original SVG
// had its icons flattened into complex compound paths that weren't worth
// reverse-engineering byte-for-byte for a static recreation.

import type { SVGProps } from 'react'

export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" {...props}>
      <path
        d="M16 3L29 27H3L16 3Z"
        fill="currentColor"
      />
      <path
        d="M16 13L22 24H10L16 13Z"
        fill="white"
        fillOpacity="0.55"
      />
    </svg>
  )
}

export function CompassIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5L13 13l-4.5 2.5L11 11l4.5-2.5Z" strokeLinejoin="round" />
    </svg>
  )
}

export function GridIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="7" cy="7" r="2.4" />
      <circle cx="17" cy="7" r="2.4" />
      <circle cx="7" cy="17" r="2.4" />
      <circle cx="17" cy="17" r="2.4" />
    </svg>
  )
}

export function BriefcaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <path d="M3.5 12.5h17" />
    </svg>
  )
}

// IconRail's own "Overview" icon — a plain home/base marker, the classic
// "you are here" dashboard icon. CompassIcon (still used by EventTabs' own,
// separate "Overview" sub-tab within one event's own dashboard) stays
// exactly as it was; this is a distinct icon for a distinct nav item, not a
// redraw of that one.
export function HouseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10" strokeLinejoin="round" />
    </svg>
  )
}

// IconRail's own "Events" icon — a ticket stub, literally what this app
// manages, replacing BriefcaseIcon (which read as "work," not "events").
export function TicketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path
        d="M4 8.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 3v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-3v-2Z"
        strokeLinejoin="round"
      />
      <path d="M14 7v10" strokeDasharray="2 2.4" strokeLinecap="round" />
    </svg>
  )
}

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" strokeLinecap="round" />
    </svg>
  )
}

// Two people — EventTabs' own "Guests" tab (a roster of many, not the one
// UserIcon already stands for elsewhere). A full front figure plus a
// partial figure behind/beside it, the common "multiple people" pictogram
// convention, rather than two full UserIcons overlapped (which reads muddy
// at this size).
export function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c.9-3.2 3.4-5 6-5s5.1 1.8 6 5" strokeLinecap="round" />
      <path d="M15.5 5.3a3 3 0 0 1 0 5.8" strokeLinecap="round" />
      <path d="M16.3 14.3c2.1.5 3.7 2.1 4.3 4.7" strokeLinecap="round" />
    </svg>
  )
}

export function FlameIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2c1 3-3 4.5-3 8a3 3 0 0 0 6 0c0-1-.4-1.7-.8-2.3 1.8 1 3.3 3 3.3 5.6a5.5 5.5 0 1 1-11 0C6.5 8.5 10 6 12 2Z" />
    </svg>
  )
}

export function RocketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M12 15c4-1 6.5-5 6.5-10.5C13 5 9 7.5 8 11.5" strokeLinejoin="round" />
      <path d="M8 11.5 5 14l0 3 3 0 2.5-3" strokeLinejoin="round" />
      <circle cx="13.7" cy="8.3" r="1.4" />
      <path d="M8 16c-1 1-1 3-1 3s2 0 3-1" strokeLinecap="round" />
    </svg>
  )
}

// Replaces the old GearIcon — a ring of thin radiating spokes that, at the
// small size this actually renders at (IconRail's own nav buttons), read as
// a sun/asterisk rather than a gear (no gear has ever had straight spokes
// instead of teeth). A sliders/equalizer glyph — three rows, each its own
// adjustable "handle" at a different position — is this app's new
// "Settings" mark instead: unambiguous at a glance, and a shape that still
// reads correctly at 20px, which the old spoked-circle never quite did.
export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M4 7h9M17 7h3" strokeLinecap="round" />
      <circle cx="14" cy="7" r="2.1" fill="currentColor" stroke="none" />
      <path d="M4 12h3M11 12h9" strokeLinecap="round" />
      <circle cx="8" cy="12" r="2.1" fill="currentColor" stroke="none" />
      <path d="M4 17h9M17 17h3" strokeLinecap="round" />
      <circle cx="14" cy="17" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function PowerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M12 4v7" strokeLinecap="round" />
      <path d="M7 6.5a7 7 0 1 0 10 0" strokeLinecap="round" />
    </svg>
  )
}
