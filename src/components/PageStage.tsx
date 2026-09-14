import type { ReactNode } from 'react'

// The standard frame every top-level page <main> renders sits inside —
// Overview and Events both use it now, and any future page (Settings, once
// that's a real page rather than a "coming soon" toast) should reach for
// this rather than inventing its own outer wrapper, the same way
// cardChrome.ts's GLASS_CARD is the one shared recipe for a card instead of
// each file re-typing its own class list.
//
// Used to be backdrop-blur-2xl here. Dropped: this box can span the entire
// scrollable dashboard body (thousands of px tall on some pages), and
// backdrop-filter can't be cached as a static texture — every scroll frame
// forces the browser to resample and reblur whatever's newly behind it. On
// a rounded, shadowed, page-length surface that's a lot of GPU/compositor
// work, and it bought little: the gradient wash behind it (<main>'s own
// background, see DashboardLayout.tsx) is smooth with no high-frequency
// detail, so blurring it barely changed how it looked. bg-cream/60 (not the
// original bg-white/15, later bg-white/60) keeps the frosted look via
// opacity alone instead — same visual, no per-frame reblur cost. The cream
// tint (not white) is the "warm card on cool page" fix — see --color-cream
// in index.css.
export default function PageStage({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[2rem] border border-cream/40 bg-cream/60 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_20px_60px_-15px_rgba(16,30,51,0.2)] sm:p-6 lg:p-8">
      {children}
    </div>
  )
}
