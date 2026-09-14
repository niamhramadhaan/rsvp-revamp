import { useRef, useState } from 'react'
import Avatar, { genConfig, type AvatarFullConfig } from 'react-nice-avatar'
import { compressImage } from '../../utils/imageCompression'
import Tooltip from '../Tooltip'
import { ResetIcon, UploadIcon } from '../icons/UiIcons'

export interface GuestAvatarProps {
  /** Some call sites (RecentActivityFeed) only ever have a bare name string,
   * not a full Guest record — this stays decoupled from the Guest type so
   * it works everywhere the old initials-circle did. */
  name: string
  imageUrl?: string
  /** A pinned config from Guest.avatarConfig — set only via the profile
   * drawer's "Randomize" action. Ignored whenever imageUrl is set; falls
   * back to the plain name-derived config when this is also unset. Omitted
   * entirely at call sites that only ever have a bare name (no full Guest
   * record to read it from), same as imageUrl above. */
  avatarConfig?: AvatarFullConfig
  sizeClassName: string
  /** STATUS_TONE[...].ring, where a status ring is contextually relevant —
   * omitted entirely at call sites that never showed one (e.g. TicketCard's
   * guest identity block). */
  ringClassName?: string
}

// The one guest-identity visual, replacing the "colored circle + initials"
// this app started with (see cardChrome.ts's now-removed getAvatarTone/
// initials) — a real uploaded photo when there is one; otherwise a
// react-nice-avatar illustrated face, either a specific one an admin pinned
// via "Randomize" (avatarConfig) or, absent that, one generated
// deterministically from the guest's own name. Same idea getAvatarTone
// always had (same name -> same look, every time) — genConfig(name) IS that
// hash, just producing a full illustrated face instead of a hue.
export default function GuestAvatar({ name, imageUrl, avatarConfig, sizeClassName, ringClassName }: GuestAvatarProps) {
  const ringClass = ringClassName ? `ring-2 ring-inset ${ringClassName}` : ''

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClassName} shrink-0 rounded-full object-cover ${ringClass}`}
      />
    )
  }

  return <Avatar shape="circle" {...(avatarConfig ?? genConfig(name))} className={`${sizeClassName} shrink-0 ${ringClass}`} />
}

export interface GuestAvatarPickerProps {
  /** Drives the generated fallback face live as it's typed (same
   * genConfig(name) hash GuestAvatar itself falls back to) — this is the
   * "already generated avatar" AddGuestDrawer shows beside Name before
   * anyone's touched Randomize or Upload at all, not a blank placeholder. */
  name: string
  imageUrl?: string
  avatarConfig?: AvatarFullConfig
  onImageChange: (url: string | undefined) => void
  onAvatarConfigChange: (config: AvatarFullConfig | undefined) => void
  sizeClassName?: string
  /** GuestAvatar's own status ring — GuestProfileDrawer's edit mode passes
   * this through so a guest's stage ring stays visible while editing, not
   * just in the read-only view. */
  ringClassName?: string
}

// This app can always afford to store a guest photo this small — the same
// budget ImageField's own guest-photo callers already pass, just co-located
// here since this component owns the upload pipeline directly now.
const AVATAR_MAX_DIMENSION = 640

// The compact "identity" control AddGuestDrawer's own header pairs with
// Name — an avatar that's never blank (a live, name-derived generated face
// stands in until there's a real photo or a pinned random one). Two actions,
// neither one GATED behind hover (a hover-only overlay was the first
// version of this — dropped per feedback that "generate a new look" and
// "upload a photo" should both just be sitting there, not hidden behind a
// gesture touch devices don't even have): the avatar circle itself IS the
// primary "generate a new look" button at all times (GuestProfileDrawer's
// own existing "Randomize" semantics — always clears any uploaded photo,
// since a generated look and a real photo are mutually exclusive), and a
// small upload badge sits permanently docked at its bottom-right corner
// (this component's own compressImage pipeline, the same one ImageField
// uses) — the one common "tap the corner badge to change a profile photo"
// pattern. Both are real <button>s, so both are already in the tab order
// with no extra work — unlike ImageField's plain "click a text link below
// the thumbnail" pattern, there's no hover-reveal step to bypass for
// keyboard use in the first place now. Hovering the avatar DOES layer a
// small randomize-icon badge over it, purely as a discoverability hint —
// the tooltip alone ("Click for a new look") wasn't a strong enough signal
// that the whole circle is clickable — but that badge is decorative
// (aria-hidden, `pointer-events-none`); it never gates the click, which
// already works with no hover at all.
export function GuestAvatarPicker({
  name,
  imageUrl,
  avatarConfig,
  onImageChange,
  onAvatarConfigChange,
  sizeClassName = 'h-16 w-16',
  ringClassName,
}: GuestAvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    setError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.')
      return
    }
    setProcessing(true)
    try {
      const dataUrl = await compressImage(file, AVATAR_MAX_DIMENSION)
      onImageChange(dataUrl)
      // A real upload always wins over a pinned generated look — see
      // GuestAvatar's own precedence — so the stale config shouldn't stick
      // around as dead state once it's no longer what's actually shown.
      onAvatarConfigChange(undefined)
    } catch {
      setError('Could not read that image — try a different file.')
    } finally {
      setProcessing(false)
    }
  }

  function handleRandomize() {
    onImageChange(undefined)
    onAvatarConfigChange(genConfig())
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`relative shrink-0 ${sizeClassName}`}>
        {/* placement="right" on both tooltips below, not the default "top"
            — this control sits right at the drawer body's own left edge,
            and a top-centered bubble (this app's usual default) routinely
            got clipped by that scroll container's edge before there was
            ever room for it to render. Opening rightward, into the middle
            of the form, always has space. */}
        <Tooltip label="Click for a new look" placement="right">
          <button
            type="button"
            onClick={handleRandomize}
            aria-label="Generate a new avatar"
            className={`group relative block overflow-hidden rounded-full outline-none transition hover:brightness-95 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:ring-offset-2 ${sizeClassName}`}
          >
            <GuestAvatar name={name.trim() || 'Guest'} imageUrl={imageUrl} avatarConfig={avatarConfig} sizeClassName={sizeClassName} ringClassName={ringClassName} />
            {/* Decorative discoverability hint, not a second control — see
                this component's own doc. aria-hidden + pointer-events-none
                so it never intercepts the click or gets its own tab stop;
                the button above it already handles both. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink-900/0 opacity-0 transition-opacity group-hover:bg-ink-900/40 group-hover:opacity-100 group-focus-visible:bg-ink-900/40 group-focus-visible:opacity-100"
            >
              <ResetIcon className="h-5 w-5 text-white" />
            </span>
          </button>
        </Tooltip>

        {/* The upload badge — permanently docked, not a hover reveal (see
            this component's own doc). A white ring separates it from
            whatever the avatar underneath happens to be, the same way a
            status-ring avatar elsewhere in this app keeps its ring
            legible against any photo.
            The positioning lives on this OWN wrapper div, not on Tooltip
            via its `className` prop — Tooltip's own root span already
            hardcodes `relative`, and handing it `absolute` through
            `className` put two conflicting `position` utilities on the
            same element; CSS resolves that by generated stylesheet order,
            not by where a class sits in the string, and `relative` won
            every time — the badge was rendering in normal flow instead of
            pinned to the avatar, drifting down into whatever content
            happened to follow. A dedicated outer div sidesteps the
            conflict entirely: it owns `absolute`, Tooltip's own span
            keeps `relative` for its own bubble's benefit. */}
        <div className="absolute -bottom-0.5 -right-0.5">
          <Tooltip label="JPG, PNG, or WebP — any size, resized automatically to fit" placement="right" wide>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={processing}
              aria-label="Upload photo"
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-accent-700 text-white shadow-sm outline-none transition hover:bg-accent-600 active:scale-[0.9] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:ring-offset-1"
            >
              <UploadIcon className="h-3 w-3" />
            </button>
          </Tooltip>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" disabled={processing} onChange={(e) => handleFile(e.target.files?.[0])} />
      {error && <p className="max-w-[9rem] text-center text-[10px] text-status-declined">{error}</p>}
    </div>
  )
}
