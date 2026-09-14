import { forwardRef, useId, useMemo, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent, type ReactNode, type SVGProps } from 'react'
import { ChevronDownIcon, ImageIcon } from './icons/UiIcons'
import { useComboboxKeyboard } from '../hooks/useComboboxKeyboard'
import { compressImage, DEFAULT_MAX_DIMENSION } from '../utils/imageCompression'

// Design B from the drawer shell comparison ("Grouped glass sections" — see
// plan.md round 16's 3-way review) — plain label-above-input fields, with
// related ones clustered into a tinted, bordered "glass section" card
// carrying an uppercase caption (the same GLASS_CARD-ish recipe the rest of
// this dashboard already uses, e.g. GuestProfileDrawer's Details/Contact
// sections). Replaces FloatingField.tsx (Design 3's floating-label recipe,
// picked in round 16, now superseded by this round's design switch).

// Exported (not just module-local) so VenueField's own search combobox can
// match these exactly rather than hand-copying the strings — same reason
// KpiTile got pulled into its own file once a second caller needed it.
export const FIELD_LABEL = 'text-xs font-semibold text-ink-900'
export const FIELD_INPUT =
  'w-full rounded-xl border-[1.5px] border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition-colors focus:border-accent-700'

export interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  autoFocus?: boolean
  /** Hint text shown while empty — a hint, never a label replacement (the
   * real label always sits above the input). */
  placeholder?: string
  disabled?: boolean
  /** A leading glyph inside the input — same slot/behavior as LabeledField's
   * own `icon` prop. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  /** Tailwind text-color class for `icon`. Only meaningful alongside `icon`. */
  iconClassName?: string
  /** Inline validation message below the input — the same status-declined
   * recipe every drawer's own submit error already uses. Absent means valid. */
  error?: string
}

// The designed text input — tinted to sit on a card surface (FieldGroup,
// settings cards, drawer bodies) instead of LabeledField's plain white box,
// which reads as a pasted-in default next to those surfaces. Rests in the
// same transparent neutral the cards themselves use, lifts to white with an
// accent border + halo on focus so the active field is unmistakable, and
// carries its own error state rather than leaving each form to hand-roll
// one. The shared starting point for any new designed form — reach for
// this before inventing another input variant. LabeledField stays as-is
// for the white-box callers it already serves; this is the tinted sibling,
// not a replacement.
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, value, onChange, type = 'text', required, autoFocus, placeholder, disabled, error, icon: Icon, iconClassName },
  ref,
) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className={FIELD_LABEL}>{label}</span>
      <div className="relative">
        {Icon && (
          <span className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${iconClassName ?? 'text-icon-gray'}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <input
          ref={ref}
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoFocus={autoFocus}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className={`w-full rounded-xl border-[1.5px] bg-black/[0.03] px-3.5 py-2.5 text-sm text-ink-900 outline-none transition placeholder:text-muted/70 disabled:opacity-60 ${
            Icon ? 'pl-10' : ''
          } ${
            error
              ? 'border-status-declined focus:border-status-declined focus:ring-4 focus:ring-status-declined/15'
              : 'border-black/10 hover:border-black/20 focus:border-accent-700 focus:bg-white focus:ring-4 focus:ring-accent-700/10'
          }`}
        />
      </div>
      {error && <span className="text-[11px] font-medium text-status-declined">{error}</span>}
    </label>
  )
})

export interface LabeledFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  autoFocus?: boolean
  /** Hint text shown while empty — a hint, never a label replacement (the
   * real label always sits above the input). Optional: most fields read
   * fine with no example to show. */
  placeholder?: string
  /** A leading glyph inside the input — AddGuestDrawer's own WhatsApp/Email
   * contact fields use this to tell the two channels apart at a glance
   * (distinct icon + tint each), rather than two identical boxes that only
   * differ by their label text. Optional: every other LabeledField in the
   * app (name, role, organization, venue…) has no real icon of its own and
   * skips this entirely. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  /** Tailwind text-color class for `icon` — e.g. 'text-accent-cyan'. Only
   * meaningful alongside `icon`. */
  iconClassName?: string
}

// forwardRef — AddGuestDrawer's own "seamless next guest" flow needs to
// refocus the Name field itself right after a successful add (the drawer
// stays open, so a plain `autoFocus` — which only ever fires once, on
// first mount — can't do this a second time).
export const LabeledField = forwardRef<HTMLInputElement, LabeledFieldProps>(function LabeledField(
  { label, value, onChange, type = 'text', required, autoFocus, placeholder, icon: Icon, iconClassName },
  ref,
) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className={FIELD_LABEL}>{label}</span>
      <div className="relative">
        {Icon && (
          <span className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${iconClassName ?? 'text-icon-gray'}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <input
          ref={ref}
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={`${FIELD_INPUT} ${Icon ? 'pl-10' : ''} placeholder:text-muted/70`}
        />
      </div>
    </label>
  )
})

export interface ComboFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  /** Every suggestion worth showing — ComboField itself narrows this down
   * to whatever matches as the user types. Free text always still works;
   * this is suggestions, not a closed enum. */
  options: string[]
  placeholder?: string
  /** A leading glyph, same slot/behavior as LabeledField's own `icon` prop
   * — left-aligned, doesn't collide with the chevron (that stays on the
   * right). */
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  iconClassName?: string
}

const MAX_COMBO_SUGGESTIONS = 8

// A stylized "type or pick" combobox — same job as LabeledField's plain
// `list`/`<datalist>` pairing (VenueField's own search dropdown uses the
// identical shape: a floating rounded card, hairline border, shadow-lg,
// hover-tinted rows), but a native `<datalist>` popup can't be themed at
// all — it renders as whatever the OS/browser's own bare dropdown looks
// like, which read as a jarring, un-designed break from the rest of this
// drawer. AddGuestDrawer's Role/Organization fields are this component's
// first callers. Full keyboard support (useComboboxKeyboard — the same
// hook VenueField's own search list uses) so this behaves like a real
// `<select>`, not a text field that happens to have a popup: ↓ opens it and
// lands on the first row, ↑/↓ move the highlight, Enter commits whichever
// row is highlighted, Escape closes without losing whatever was typed.
export function ComboField({ label, value, onChange, options, placeholder, icon: Icon, iconClassName }: ComboFieldProps) {
  const id = useId()
  const listId = useId()
  const [open, setOpen] = useState(false)

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase()
    const pool = query ? options.filter((o) => o.toLowerCase().includes(query)) : options
    // Nothing to suggest once the field already exactly matches an option —
    // there'd be nothing to actually pick.
    return pool.filter((o) => o.toLowerCase() !== query).slice(0, MAX_COMBO_SUGGESTIONS)
  }, [options, value])

  const { highlightedIndex, setHighlightedIndex, handleKeyDown } = useComboboxKeyboard({
    itemCount: suggestions.length,
    open,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    onSelect: (index) => {
      onChange(suggestions[index])
      setOpen(false)
    },
  })

  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className={FIELD_LABEL}>{label}</span>
      <div className="relative">
        {Icon && (
          <span className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${iconClassName ?? 'text-icon-gray'}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && highlightedIndex >= 0 ? `${listId}-${highlightedIndex}` : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
            setHighlightedIndex(-1)
          }}
          onFocus={() => setOpen(true)}
          // Deferred, same as VenueField's own combobox — a plain blur would
          // close this before a suggestion's onMouseDown gets a chance to
          // register as a click.
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={`${FIELD_INPUT} pr-9 ${Icon ? 'pl-10' : ''}`}
        />
        <ChevronDownIcon
          aria-hidden="true"
          className={`pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-icon-gray transition-transform ${open ? 'rotate-180' : ''}`}
        />
        {open && suggestions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            // Chromium auto-includes an overflow:auto container with
            // overflowing content in the tab sequence (so it can be
            // keyboard-scrolled on its own) unless told not to — an empty,
            // purposeless stop here since the input's own arrow keys
            // already drive this list.
            tabIndex={-1}
            className="combo-scrollbar absolute z-20 mt-1.5 max-h-52 w-full divide-y divide-black/5 overflow-y-auto rounded-xl border border-black/10 bg-white py-1 shadow-lg"
          >
            {suggestions.map((option, index) => (
              <li key={option} id={`${listId}-${index}`} role="option" aria-selected={index === highlightedIndex}>
                <button
                  type="button"
                  // Reachable by pointer and by the input's own arrow-key
                  // handling (aria-activedescendant), but not by a plain
                  // Tab — real focus never leaves the input during keyboard
                  // navigation, so these being individually tabbable would
                  // just mean Tab has to click through every suggestion
                  // before reaching the next real field.
                  tabIndex={-1}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(option)
                    setOpen(false)
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`block w-full truncate px-3.5 py-2 text-left text-sm transition ${
                    index === highlightedIndex ? 'bg-accent-700/10 text-accent-700' : 'text-ink-900 hover:bg-accent-700/10 hover:text-accent-700'
                  }`}
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  )
}

export interface LabeledTextAreaProps {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  /** Hard cap (native `maxlength` — blocks typing/pasting past it, not just
   * a warning) plus a live "N/max" counter under the field. Optional: most
   * LabeledTextAreas in the app (currently none) need no limit at all. */
  maxLength?: number
  /** Extra classes merged onto the textarea itself — `!`-prefixed so a
   * caller can actually override FIELD_INPUT's own bg-white/border (plain
   * appended classes can't reliably beat a shared utility already baked
   * into FIELD_INPUT, since Tailwind's own generated-CSS order — not
   * className string order — decides which wins otherwise). Optional: most
   * callers are fine with FIELD_INPUT's own default white surface. */
  className?: string
}

export function LabeledTextArea({ label, value, onChange, rows = 3, maxLength, className = '' }: LabeledTextAreaProps) {
  const id = useId()
  const remaining = maxLength !== undefined ? maxLength - value.length : undefined
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className={FIELD_LABEL}>{label}</span>
        {maxLength !== undefined && (
          <span className={`text-[11px] tabular-nums ${remaining !== undefined && remaining <= 20 ? 'text-status-pending' : 'text-muted'}`}>
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        className={`${FIELD_INPUT} resize-none ${className}`}
      />
    </label>
  )
}

export interface ImageFieldProps {
  label: string
  value?: string
  onChange: (value: string | undefined) => void
  /** How large the long edge (px) is allowed to end up after the resize
   * below — 1600 (the default) fits a full-width hero comfortably; guest-
   * photo callers pass a smaller value (their own avatar circle never
   * shows one past a few dozen px, so there's nothing to gain from storing
   * one at hero resolution). */
  maxDimension?: number
}

// compressImage/DEFAULT_MAX_DIMENSION now live in utils/imageCompression.ts
// (see that file's own doc for why — a mixed component/plain-function
// export here was breaking Vite's fast-refresh boundary).

export function ImageField({ label, value, onChange, maxDimension = DEFAULT_MAX_DIMENSION }: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  async function handleFile(file: File | undefined) {
    setError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.')
      return
    }
    setProcessing(true)
    try {
      const dataUrl = await compressImage(file, maxDimension)
      onChange(dataUrl)
    } catch {
      setError('Could not read that image — try a different file.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={FIELD_LABEL}>{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-black/5">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted" />}
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          {/* A real <button> triggering the file input via a ref, not a
              <label htmlFor> pointing at a display:none input — a label has
              no native tabindex of its own, and a hidden input is excluded
              from the tab order too, so that pairing (still used verbatim
              nowhere left in this app) was a mouse-only dead end: Tab could
              never reach "Upload photo" at all. */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={processing}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-black/5 px-3 py-2 text-xs font-semibold text-ink-900 transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 hover:bg-black/10"
          >
            {processing ? 'Processing…' : value ? 'Change photo' : 'Upload photo'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={processing}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {value && !processing && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="w-fit text-xs font-medium text-status-declined transition hover:underline"
            >
              Remove
            </button>
          )}
          <p className="text-[11px] text-muted">Any image file — resized automatically to fit</p>
          {error && <p className="text-xs text-status-declined">{error}</p>}
        </div>
      </div>
    </div>
  )
}

const DEFAULT_FOCAL_POINT = { x: 50, y: 50 }
// The banner's own real proportions (EventBanner's h-56/h-64 at typical
// content width) don't fit a neat ratio name — 3.5:1 is the closest round
// stand-in, close enough that whatever crop looks right here looks right on
// the real hero too.
const BANNER_ASPECT = 'aspect-[7/2]'

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, n))
}

export interface BannerImageFieldProps {
  label: string
  value?: string
  onChange: (value: string | undefined) => void
  /** Where the crop window sits within `value` — see Event.imageFocalPoint's
   * own doc. Undefined reads as centered, same as EventBanner's own
   * fallback. */
  focalPoint?: { x: number; y: number }
  onFocalPointChange: (point: { x: number; y: number }) => void
}

// EventBanner's own cover-photo input — a landscape preview at (roughly)
// the real banner's own aspect ratio, rather than ImageField's generic small
// thumbnail, since a photo that crops badly at 7:2 isn't obvious from a
// squarish preview until it's already saved. Drag the preview to slide the
// crop window around (Facebook's own "reposition cover photo" gesture) —
// most uploaded photos aren't shot at 7:2 to begin with, so this is the
// difference between "the subject's head is cut off" and a banner that
// actually shows what the photo is of.
export function BannerImageField({ label, value, onChange, focalPoint, onFocalPointChange }: BannerImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const point = focalPoint ?? DEFAULT_FOCAL_POINT
  // The drag gesture's own start reference — a ref, not state: updated on
  // every pointermove, but never itself something the preview needs to
  // re-render off of (only `focalPoint`, read back from the parent form's
  // own state, does).
  const dragStart = useRef<{ x: number; y: number; focalX: number; focalY: number } | null>(null)

  async function handleFile(file: File | undefined) {
    setError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.')
      return
    }
    setProcessing(true)
    try {
      const dataUrl = await compressImage(file, DEFAULT_MAX_DIMENSION)
      onChange(dataUrl)
      // A brand new photo's own subject has nothing to do with wherever the
      // previous photo's crop window happened to be left — start centered
      // again rather than carrying a stale offset onto unrelated content.
      onFocalPointChange(DEFAULT_FOCAL_POINT)
    } catch {
      setError('Could not read that image — try a different file.')
    } finally {
      setProcessing(false)
    }
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!value) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = { x: e.clientX, y: e.clientY, focalX: point.x, focalY: point.y }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    if (!start) return
    const rect = e.currentTarget.getBoundingClientRect()
    // Dragging the preview follows the cursor like grabbing the photo
    // itself — which means object-position moves the OPPOSITE way: dragging
    // right brings the image's own left portion into view, so X decreases.
    const dxPercent = ((e.clientX - start.x) / rect.width) * 100
    const dyPercent = ((e.clientY - start.y) / rect.height) * 100
    onFocalPointChange({ x: clampPercent(start.focalX - dxPercent), y: clampPercent(start.focalY - dyPercent) })
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    dragStart.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={FIELD_LABEL}>{label}</span>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`group relative w-full touch-none select-none overflow-hidden rounded-xl border border-black/10 bg-black/5 ${BANNER_ASPECT} ${value ? 'cursor-move' : ''}`}
      >
        {value ? (
          <>
            <img
              src={value}
              alt=""
              draggable={false}
              className="pointer-events-none h-full w-full object-cover"
              style={{ objectPosition: `${point.x}% ${point.y}%` }}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/20 group-hover:opacity-100">
              <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">Drag to reposition</span>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* Real <button> + ref, not <label htmlFor> — see ImageField's own
            doc for why the label pairing was a keyboard dead end. */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-black/5 px-3 py-2 text-xs font-semibold text-ink-900 transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 hover:bg-black/10"
        >
          {processing ? 'Processing…' : value ? 'Change photo' : 'Upload photo'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" disabled={processing} onChange={(e) => handleFile(e.target.files?.[0])} />
        {value && !processing && (
          <button type="button" onClick={() => onChange(undefined)} className="text-xs font-medium text-status-declined transition hover:underline">
            Remove
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted">{value ? 'Drag the preview above to reposition' : 'Any image file — resized automatically to fit'}</p>
      {error && <p className="text-xs text-status-declined">{error}</p>}
    </div>
  )
}

// Event logo input — a square 1:1 mark (the profile-photo-like chip the
// event switcher dropdown/sheet shows per event), not the wide banner hero
// BannerImageField handles. Square preview at the same h-16 footprint as
// ImageField's own thumbnail so the drawer stays compact; compresses to 512px
// (plenty for a ~40px chip) so a logo never eats the shared localStorage
// budget the way a full-res banner could.
export function LogoImageField({ label, value, onChange }: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  async function handleFile(file: File | undefined) {
    setError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.')
      return
    }
    setProcessing(true)
    try {
      const dataUrl = await compressImage(file, 512)
      onChange(dataUrl)
    } catch {
      setError('Could not read that image — try a different file.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={FIELD_LABEL}>{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-black/5">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted" />}
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          {/* Real <button> + ref, not <label htmlFor> — see ImageField's own
              doc for why the label pairing was a keyboard dead end. */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={processing}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-black/5 px-3 py-2 text-xs font-semibold text-ink-900 transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 hover:bg-black/10"
          >
            {processing ? 'Processing…' : value ? 'Change logo' : 'Upload logo'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={processing}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {value && !processing && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="w-fit text-xs font-medium text-status-declined transition hover:underline"
            >
              Remove
            </button>
          )}
          <p className="text-[11px] text-muted">Square works best — shown in the event list</p>
          {error && <p className="text-xs text-status-declined">{error}</p>}
        </div>
      </div>
    </div>
  )
}

export interface FieldGroupProps {
  label: string
  children: ReactNode
  /** An InfoTooltip (or similar small glyph) next to the caption — for a
   * section whose fields raise an "and then what happens?" question this
   * label alone doesn't answer (e.g. AddGuestDrawer's own Contact group).
   * Optional: most FieldGroups need nothing extra here. */
  labelExtra?: ReactNode
}

// The "glass section" itself — groups related fields (e.g. Contact:
// WhatsApp + Email) under one tinted, bordered card with an uppercase
// caption, exactly the comparison mockup's "Design 2" recipe.
export function FieldGroup({ label, children, labelExtra }: FieldGroupProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-black/[0.03] p-4">
      <div className="flex items-center gap-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
        {labelExtra}
      </div>
      {children}
    </div>
  )
}
