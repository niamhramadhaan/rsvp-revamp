import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useEnterTransition } from '../hooks/useEnterTransition'
import { useProfile } from '../data/hooks'
import { UserIcon } from './icons/NavIcons'
import type { AppRole } from '../data/types'

export interface UserIdCardModalProps {
  open: boolean
  onClose: () => void
}

const ROLE_LABEL: Record<AppRole, string> = { admin: 'Admin', staff: 'Staff' }

// Both roles work for the same one org — "Representative" always reads
// Gamefinity regardless of Admin/Staff (see this file's own doc further
// down), so this is a plain constant, not derived from `profile` at all.
const ORG_NAME = 'Gamefinity'

// A pure display badge (no editing here at all — see SettingsPage's own
// user editor for that) styled like a physical membership/ID card: a photo
// frame with a metallic foil sheen that tracks the cursor, the whole card
// tilting toward it (same direct-DOM-transform technique KpiTile's own
// hover tilt uses — see that file's own doc for why a plain style-mutation,
// not React state, drives this every pointermove frame), a light frosted-
// blue glass surface instead of a flat dark fill, and a small bottom notch
// (a real cutout via `mask-image`, not TicketCard's own "paint a circle in
// the known backdrop color" trick — this card's own backdrop is a
// translucent blurred scrim, not one flat color, so a true mask cutout is
// the only version of that trick that stays correct here) so it doesn't
// read as one flat rounded rectangle.
//
// "Representative" here always reads the org name, not a derived stat —
// both Admin and Staff represent the same one org, so there's nothing
// role-dependent to compute. Role itself still shows in the stat row next
// to it, and role is what useCanAccess actually enforces against elsewhere
// (there's no login tying a specific AppUser to this browser, so
// Profile.role stands in for "what the current session can do" — see
// data/hooks.ts's own doc) — just not surfaced as an on-photo pill any more.
export default function UserIdCardModal({ open, onClose }: UserIdCardModalProps) {
  const [profile] = useProfile()
  const entered = useEnterTransition(open)
  const cardRef = useRef<HTMLDivElement>(null)
  const shineRef = useRef<HTMLDivElement>(null)

  // One pointermove drives two direct DOM writes: the whole card's own 3D
  // tilt, and the metallic overlay's shine position (tracking the same
  // cursor offset, just scaled differently) — a "foil card" reacting as one
  // physical object rather than two independent effects.
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const card = cardRef.current
    if (!card || e.pointerType === 'touch') return
    const rect = card.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    card.style.transform = `perspective(900px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg)`
    if (shineRef.current) shineRef.current.style.backgroundPosition = `${50 + px * 60}% ${50 + py * 60}%`
  }

  function handlePointerLeave() {
    if (cardRef.current) cardRef.current.style.transform = ''
    if (shineRef.current) shineRef.current.style.backgroundPosition = '50% 50%'
  }

  return (
    <div
      inert={!open}
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ease-out ${
        entered ? 'bg-ink-900/40 opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* The glass card itself — a soft white-to-blue gamefinity wash
          (color-mix toward white, not the flat opaque navy this used to be)
          under a translucent white glass surface, same "frosted, not flat"
          language IconRail's own desktop capsule already uses. The bottom
          notch is a real `mask-image` cutout: a small circle at 50%/100%
          carved out of the card's own rounded-rect shape. */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Profile"
        onClick={(e) => e.stopPropagation()}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{
          backgroundImage:
            'linear-gradient(160deg, color-mix(in srgb, var(--color-accent-cyan-light) 38%, white) 0%, color-mix(in srgb, var(--color-accent-700) 22%, white) 100%)',
          WebkitMaskImage: 'radial-gradient(circle 14px at 50% 100%, transparent 99%, white 100%)',
          maskImage: 'radial-gradient(circle 14px at 50% 100%, transparent 99%, white 100%)',
        }}
        // A deeper, two-layer drop shadow (a wide soft one plus a tighter,
        // closer one — same "elevated card" recipe PageStage's own glass
        // card shadow uses, just deepened) plus an inset top highlight
        // catching light along the glass's own top edge, for more real
        // depth than a flat shadow-2xl gave it.
        className={`w-full max-w-xs rounded-[28px] border border-white/60 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_35px_70px_-20px_rgba(16,30,51,0.5),0_14px_30px_-12px_rgba(16,30,51,0.35)] backdrop-blur-2xl transition-transform duration-300 ease-out [transform-style:preserve-3d] ${
          entered ? 'scale-100' : 'scale-95'
        }`}
      >
        {/* The frame — photo fills it edge-to-edge, no role pill on top of
            it any more (see this file's own top doc). */}
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/50 shadow-lg">
          {profile.imageUrl ? (
            <img src={profile.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--color-accent-cyan) 55%, transparent) 0%, transparent 65%), linear-gradient(180deg, var(--color-accent-700) 0%, var(--color-ink-900) 85%)',
              }}
            >
              <UserIcon className="h-16 w-16 text-white/70" />
            </div>
          )}

          {/* The metallic sheen — a repeating diagonal foil band, blended
              via `overlay` so it reads as a shifting metallic highlight
              across the photo rather than a flat tint on top of it. Toned
              down from an earlier pass (halved opacities) — it was
              overpowering the photo itself rather than just glinting across
              it. Its background-position is the one thing
              handlePointerMove writes directly (see this file's own top
              doc) — no separate animation loop, the shine only moves
              because the cursor did. */}
          <div
            ref={shineRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(115deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.02) 6%, rgba(255,255,255,0.28) 12%, rgba(0,0,0,0.08) 20%, rgba(255,255,255,0.35) 28%)',
              backgroundSize: '250% 250%',
              backgroundPosition: '50% 50%',
              mixBlendMode: 'overlay',
            }}
          />
        </div>

        {/* Nameplate — brand mark + name, plain text (no editing here — see
            this file's own top doc). */}
        <div className="mt-4 flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2">
            <img src="/gamefinity icon.png" alt="" className="h-5 w-5 shrink-0 rounded-md object-contain" />
            <p className="font-display text-lg font-bold text-ink-900">{profile.name}</p>
          </div>

          <div className="h-px w-full bg-black/10" />

          <div className="grid w-full grid-cols-2 divide-x divide-black/10 pb-1">
            <div className="flex flex-col items-center gap-0.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Role</p>
              <p className="font-display text-sm font-bold text-ink-900">{ROLE_LABEL[profile.role] ?? profile.role}</p>
            </div>
            <div className="flex flex-col items-center gap-0.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Representative</p>
              <p className="font-display text-sm font-bold text-ink-900">{ORG_NAME}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
