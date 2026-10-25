import type { ReactNode, SVGProps } from "react";

/**
 * Inline SVG icon set (lucide-react is NOT installed — scaffold constraint).
 * Icons are decorative by default (`aria-hidden`): the accessible name always
 * comes from the surrounding text or the `aria-label` of the icon-only control
 * (ACCESSIBILITY §2.2).
 */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Glyph({ size = 16, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ── Navigation & shell ─────────────────────────────────────────────────── */
export function LayoutDashboard(p: IconProps) {
  return (
    <Glyph {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Glyph>
  );
}

export function Menu(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Glyph>
  );
}

export function Settings(p: IconProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </Glyph>
  );
}

export function Home(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 21v-7h6v7" />
    </Glyph>
  );
}

export function List(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </Glyph>
  );
}

export function MessageSquare(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Glyph>
  );
}

export function History(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3.5 2" />
    </Glyph>
  );
}

export function User(p: IconProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </Glyph>
  );
}

export function LogOut(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </Glyph>
  );
}

/* ── Actions ────────────────────────────────────────────────────────────── */
export function Search(p: IconProps) {
  return (
    <Glyph {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Glyph>
  );
}

export function Plus(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M12 5v14M5 12h14" />
    </Glyph>
  );
}

export function Send(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </Glyph>
  );
}

export function Trash(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <path d="M10 11v6M14 11v6" />
    </Glyph>
  );
}

export function Archive(p: IconProps) {
  return (
    <Glyph {...p}>
      <rect x="2" y="4" width="20" height="5" rx="1" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M10 13h4" />
    </Glyph>
  );
}

export function Pencil(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Glyph>
  );
}

export function RotateCcw(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
      <path d="M3 3v5h5" />
    </Glyph>
  );
}

/* ── Chevrons & status glyphs ───────────────────────────────────────────── */
export function ChevronRight(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="m9 6 6 6-6 6" />
    </Glyph>
  );
}

export function ChevronLeft(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="m15 6-6 6 6 6" />
    </Glyph>
  );
}

export function ChevronDown(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="m6 9 6 6 6-6" />
    </Glyph>
  );
}

export function Check(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="m5 13 4 4L19 7" />
    </Glyph>
  );
}

export function X(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Glyph>
  );
}

export function CheckCircle(p: IconProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </Glyph>
  );
}

export function ShieldCheck(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </Glyph>
  );
}

export function CircleDashed(p: IconProps) {
  return (
    <Glyph {...p} strokeDasharray="4 3">
      <circle cx="12" cy="12" r="9" />
    </Glyph>
  );
}

export function Lightbulb(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5a6 6 0 0 0-12 0c0 1 .2 2.2 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6M10 22h4" />
    </Glyph>
  );
}

export function AlertTriangle(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </Glyph>
  );
}

export function WifiOff(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M2 2l20 20" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M5 12.9a10 10 0 0 1 3.2-2.2" />
      <path d="M19 12.9a10 10 0 0 0-4.6-2.6" />
      <path d="M12 20h.01" />
    </Glyph>
  );
}

export function Clock(p: IconProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Glyph>
  );
}

/* ── Domain glyphs ──────────────────────────────────────────────────────── */
export function Box(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
      <path d="M3.5 8.5 12 13l8.5-4.5" />
      <path d="M12 13v8" />
    </Glyph>
  );
}

export function Package(p: IconProps) {
  return <Box {...p} />;
}

export function MapPin(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </Glyph>
  );
}

export function Sparkles(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9Z" />
      <path d="M19 15.5 19.7 17l1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7Z" />
    </Glyph>
  );
}

export function Sun(p: IconProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
    </Glyph>
  );
}

export function Moon(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </Glyph>
  );
}

export function Monitor(p: IconProps) {
  return (
    <Glyph {...p}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </Glyph>
  );
}

export function Download(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </Glyph>
  );
}

/** Printer (label cetak, FR-031): used for the print-labels entry points. */
export function Printer(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </Glyph>
  );
}
