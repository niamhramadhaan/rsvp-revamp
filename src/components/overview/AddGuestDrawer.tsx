import { useId, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import type { AvatarFullConfig } from 'react-nice-avatar'
import DrawerPanelPortal from '../DrawerPanelPortal'
import { LabeledField, ComboField, FieldGroup } from '../GroupedField'
import { InfoTooltip } from '../Tooltip'
import GuestAvatar, { GuestAvatarPicker } from './GuestAvatar'
import { createGuest, createGuestsBulk } from '../../data/guests'
import { useAllGuests } from '../../data/hooks'
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator'
import { distinctSorted } from '../../data/selectors'
import { UserPlusIcon, UploadIcon, CloseIcon, ChatBubbleIcon, MailIcon, CheckmarkIcon, BuildingIcon, DownloadIcon } from '../icons/UiIcons'
import { UserIcon, BriefcaseIcon } from '../icons/NavIcons'
import type { Guest, NewGuestInput } from '../../data/types'
import Button, { type ButtonProgress } from '../Button'

export interface AddGuestDrawerProps {
  open: boolean
  onClose: () => void
  eventId: string | null
  onCreated?: (guest: Guest) => void
  /** Fired once after a bulk Excel import commits — a single summary (this
   * many guests imported), not one onCreated call per row, which would
   * fire off a toast per guest for a 50-row file. Optional, same as
   * onCreated — a caller that never opens bulk mode has no reason to wire
   * it up (there's nothing here stopping a caller from wiring up only one
   * of the two, though every current caller wires up both). `duplicates` is
   * how many rows were silently skipped for sharing an email/phone with an
   * existing guest or an earlier row in the same file (see
   * createGuestsBulk's own doc) — surfaced here so the caller's own summary
   * toast can mention it, the same way it already mentions blank-name
   * skips via the in-drawer preview. */
  onBulkCreated?: (guests: Guest[], duplicates: number) => void
}

type AddMode = 'single' | 'bulk'

// Header aliases this recognizes when matching a spreadsheet's own column
// names to NewGuestInput's fields — tolerant of the handful of names a
// spreadsheet export/manual header is actually likely to use, not just one
// exact string.
const HEADER_ALIASES: Record<keyof NewGuestInput, string[]> = {
  name: ['name', 'full name', 'guest name'],
  wa: ['wa', 'whatsapp', 'phone', 'phone number'],
  email: ['email', 'e-mail'],
  role: ['role', 'title'],
  organization: ['organization', 'organisation', 'company', 'org'],
  imageUrl: [],
  avatarConfig: [],
}

// The baseline role picks a brand-new event's ComboField dropdown offers
// before any guest has ever been added — a press conference's own most
// common roles, not an exhaustive list (typing anything else still works,
// same as every other ComboField value). Merged into roleOptions below,
// not a hardcoded fallback only shown when allGuests is empty — a returning
// admin should keep seeing these alongside whatever's already been typed.
const DEFAULT_ROLE_OPTIONS = ['Press', 'Speaker', 'Guest', 'Other']

interface ParsedImport {
  rows: NewGuestInput[]
  skipped: number
}

// A header cell normalized for alias matching — trim/lowercase (same as
// before), plus stripping a trailing "*" (and any space before it): this
// app's own downloadable template (see the "Download template" link below)
// marks its one required column "Name*", which is otherwise a literal
// non-match against the plain "name" alias.
function normalizeHeaderCell(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s*\*+$/, '')
}

// Finds which row in a sheet is the REAL header row, and which column is
// which within it (case/whitespace/asterisk-insensitive against
// HEADER_ALIASES above) — NOT simply "whichever row comes first." This
// app's own template (see the Download template link) leads with a title
// row and an instructions row before the actual "Name*, WhatsApp, Email,
// Role, Organization" header; a naive "first non-blank row is the header"
// rule would read that title row as the header instead, fail to find a
// "Name" column in it, and reject the app's own correctly-filled-out
// template. Instead, this scans every row for the first one that resolves
// a recognizable Name column, and treats THAT as the header — a genuine
// column-format mismatch (no row anywhere has anything matching a Name
// alias) still fails, which is the actual point of this validation: a
// wrong-shaped file has to be rejected, not silently misread from whatever
// row happens to be first.
function findHeaderRow(rows: string[][]): { headerRowIndex: number; columnIndex: Partial<Record<keyof NewGuestInput, number>> } | null {
  for (let i = 0; i < rows.length; i++) {
    const normalized = rows[i].map(normalizeHeaderCell)
    const columnIndex: Partial<Record<keyof NewGuestInput, number>> = {}
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [keyof NewGuestInput, string[]][]) {
      const idx = normalized.findIndex((h) => aliases.includes(h))
      if (idx !== -1) columnIndex[field] = idx
    }
    if (columnIndex.name !== undefined) return { headerRowIndex: i, columnIndex }
  }
  return null
}

// Reads an .xlsx workbook's first sheet, locates its real header row (see
// findHeaderRow above), then maps every row after it into a NewGuestInput —
// a row with no name (the one required field, same rule the manual form
// enforces via `required`) is silently skipped rather than failing the
// whole import over one bad line, and skipped is returned so the preview
// can still say so. A file with no recognizable Name column ANYWHERE — the
// wrong template, a renamed/deleted column, a completely unrelated
// spreadsheet — fails outright with an explicit error rather than silently
// importing garbage or nothing at all.
//
// `xlsx` (SheetJS) is dynamically imported here, not at module load — it's
// a genuinely large parser, and most visits to this drawer never touch
// bulk-import mode at all, the same "don't pay for it until it's actually
// used" call this app already makes for CheckInDrawer's html5-qrcode (see
// OverviewContent's own lazy() import there). Installed from SheetJS's own
// CDN tarball (see package.json), not the `xlsx` npm registry build — the
// registry copy is stuck on a version with known unpatched high-severity
// vulnerabilities; SheetJS's own current instructions are to install the
// patched build from their CDN instead.
async function parseGuestsXlsx(buffer: ArrayBuffer): Promise<{ error: string } | ParsedImport> {
  const XLSX = await import('xlsx')

  let workbook: ReturnType<typeof XLSX.read>
  try {
    workbook = XLSX.read(buffer, { type: 'array' })
  } catch {
    return { error: 'Could not read that file — make sure it’s a valid .xlsx spreadsheet.' }
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return { error: 'That spreadsheet has no sheets in it.' }

  // header: 1 → rows of raw cells (an array of arrays), the same shape the
  // old hand-rolled CSV parser produced. Cell values come back typed
  // (numbers, dates, booleans) depending on how the spreadsheet stored
  // them; String(…) normalizes every cell to plain text before the
  // trim()-based matching below, which expects strings the way a CSV's
  // cells always were. Fully-blank rows are dropped outright (this app's
  // own template pads out to row 1000 with nothing in them) — they can
  // never be a header or a real data row either way.
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  const table = raw.map((row) => row.map((cell) => (cell == null ? '' : String(cell)))).filter((r) => r.some((cell) => cell.trim() !== ''))
  if (table.length === 0) return { error: 'That file is empty.' }

  const found = findHeaderRow(table)
  if (!found) return { error: 'Couldn’t find a "Name" column anywhere in that file — check it matches the template’s columns.' }
  const { headerRowIndex, columnIndex } = found

  const dataRows = table.slice(headerRowIndex + 1)
  if (dataRows.length === 0) return { error: 'That file has no data rows below the header.' }

  let skipped = 0
  const rows: NewGuestInput[] = []
  for (const cells of dataRows) {
    const name = cells[columnIndex.name!]?.trim()
    if (!name) {
      skipped++
      continue
    }
    rows.push({
      name,
      wa: columnIndex.wa !== undefined ? cells[columnIndex.wa]?.trim() : undefined,
      email: columnIndex.email !== undefined ? cells[columnIndex.email]?.trim() : undefined,
      role: columnIndex.role !== undefined ? cells[columnIndex.role]?.trim() : undefined,
      organization: columnIndex.organization !== undefined ? cells[columnIndex.organization]?.trim() : undefined,
    })
  }
  return { rows, skipped }
}

// Manual "add one guest" as one flat form, plus a second, bulk Excel mode for
// everything else. Used to be a 3-step wizard (Identity → Contact →
// Details) — reverted per feedback that clicking through 3 steps for a
// single guest was more overhead than it was worth, back to every field on
// one screen. Seat assignment, invites, and RSVP all start unset either
// way — those are separate flows (Guests & Seating's seat picker, Send
// Invitations) layered on afterward, not something this form decides.
// There's no "Group" field here either — grouping lives entirely on the
// seat map's own SeatGroup (see types.ts's Guest doc), assigned once a guest
// actually gets seated, not guessed at while adding them.
export default function AddGuestDrawer({ open, onClose, eventId, onCreated, onBulkCreated }: AddGuestDrawerProps) {
  const formId = useId()
  const [mode, setMode] = useState<AddMode>('single')
  const modeRailRef = useRef<HTMLDivElement>(null)
  const modeIndicator = useSlidingIndicator(modeRailRef, mode)
  const [name, setName] = useState('')
  const [wa, setWa] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [organization, setOrganization] = useState('')
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined)
  const [avatarConfig, setAvatarConfig] = useState<AvatarFullConfig | undefined>(undefined)
  const [contactError, setContactError] = useState(false)
  // One shared progress state — single-add and bulk-import each show their
  // own Button, but never both at once (mode gates which renders), so there
  // is only ever one "current" submit in flight. Reset to idle on every
  // mode switch (see the toggle buttons below) so a stale flash from one
  // mode can't bleed into the other's freshly-mounted Button.
  const [progress, setProgress] = useState<ButtonProgress>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // "Add guest" stays open across a whole run of adds now (see handleSubmit)
  // — these two track that run so the footer/form can give feedback each
  // guest actually landed, instead of the old "drawer just closes" signal.
  const [addedCount, setAddedCount] = useState(0)
  const [lastAddedGuest, setLastAddedGuest] = useState<Guest | null>(null)

  // Role/Organization suggestions — every distinct value already used on
  // ANY guest, across every event (not just this one — a VIP's org doesn't
  // change event to event, and reusing the same list here is what lets
  // "type it once, pick it from the dropdown from then on" actually work).
  // Sourced live from the guest table itself rather than a separate stored
  // list, matching this app's existing "derive, don't duplicate" rule for
  // groupLabel/free-text values — a newly added guest's own role/org is
  // already a suggestion for the very next guest the moment it's saved.
  const allGuests = useAllGuests()
  // Merged with a fixed baseline (see DEFAULT_ROLE_OPTIONS) — a brand-new
  // event with no guests yet still gets sensible role picks to start from,
  // rather than an empty dropdown until someone's typed one in by hand.
  // distinctSorted itself handles the case where a guest's own role already
  // duplicates one of these (e.g. someone already typed "Press").
  const roleOptions = useMemo(() => distinctSorted([...DEFAULT_ROLE_OPTIONS, ...allGuests.map((g) => g.role)]), [allGuests])
  const organizationOptions = useMemo(() => distinctSorted(allGuests.map((g) => g.organization)), [allGuests])

  // Bulk mode's own state — a parsed workbook (or an error message) plus
  // whichever file name is currently showing, and a dragging flag purely
  // for the dropzone's own hover styling.
  const [fileName, setFileName] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ParsedImport | { error: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Holds a successful bulk import across the Button's own 1s "Saved!"
  // flash — closing (and onBulkCreated) waits for handleBulkProgressSettle,
  // same reasoning as CreateEventDrawer's own pendingEventRef.
  const pendingBulkRef = useRef<{ created: Guest[]; duplicates: number } | null>(null)

  function reset() {
    setMode('single')
    setName('')
    setWa('')
    setEmail('')
    setRole('')
    setOrganization('')
    setImageUrl(undefined)
    setAvatarConfig(undefined)
    setContactError(false)
    setProgress('idle')
    setSubmitError(null)
    setFileName(null)
    setImportResult(null)
    setDragging(false)
    setAddedCount(0)
    setLastAddedGuest(null)
  }

  // Clears just the per-guest identity fields after a successful add —
  // Role/Organization deliberately carry over (the next guest is very often
  // from the same table/company; both are now quick-pick dropdowns anyway
  // if the next one isn't) — then refocuses Name so typing the next guest
  // can start immediately with no click needed. Photo/avatarConfig always
  // reset though: unlike Role/Org, a specific person's face has no reason
  // to carry over onto whoever's typed next.
  function resetForNextGuest() {
    setName('')
    setWa('')
    setEmail('')
    setImageUrl(undefined)
    setAvatarConfig(undefined)
    setContactError(false)
    nameInputRef.current?.focus()
  }

  function handleClose() {
    onClose()
    reset()
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    setImportResult(null)
    try {
      const buffer = await file.arrayBuffer()
      setImportResult(await parseGuestsXlsx(buffer))
    } catch {
      setImportResult({ error: 'Could not read that file.' })
    }
  }

  async function handleBulkSubmit() {
    if (!eventId || !importResult || 'error' in importResult || importResult.rows.length === 0) return
    setSubmitError(null)
    setProgress('loading')
    // See EditEventDrawer's handleSubmit for why this is wrapped — a
    // localStorage quota throw here used to leave this button reading
    // "Importing…" forever instead of failing visibly.
    try {
      pendingBulkRef.current = await createGuestsBulk(eventId, importResult.rows)
      setProgress('success')
    } catch {
      setSubmitError('Could not import — your browser storage may be full.')
      setProgress('idle')
    }
  }

  function handleBulkProgressSettle() {
    const pending = pendingBulkRef.current
    pendingBulkRef.current = null
    if (pending) onBulkCreated?.(pending.created, pending.duplicates)
    reset()
    onClose()
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!eventId || !name.trim()) return
    // At least one contact method — matches plan.md's manual-add spec ("at
    // least one contact required"). Not expressible as native `required` on
    // either field alone, so this is a manual check rather than a hard
    // block on either input.
    if (!wa.trim() && !email.trim()) {
      setContactError(true)
      return
    }

    setSubmitError(null)
    setProgress('loading')
    try {
      const result = await createGuest(eventId, {
        name: name.trim(),
        wa: wa.trim(),
        email: email.trim(),
        role: role.trim(),
        organization: organization.trim(),
        imageUrl,
        avatarConfig,
      })
      // Rejected — same email/phone already on this event's roster (see
      // createGuest's own findDuplicateContact doc). Surfaced as an ordinary
      // submit error, same place/style a storage-quota failure already
      // shows in — not a special dialog, since it's just as recoverable
      // (edit the field, try again) as any other validation failure here.
      if (!result.ok || !result.guest) {
        setSubmitError(result.reason ?? 'Could not add this guest.')
        setProgress('idle')
        return
      }
      const guest = result.guest
      onCreated?.(guest)
      // Stays open — see resetForNextGuest's own doc. addedCount/
      // lastAddedGuest back the footer's "Done" relabel and the inline
      // confirmation below the form, the two pieces of in-drawer feedback
      // that make adding a run of guests actually feel continuous instead
      // of each one silently vanishing into the list behind this panel.
      // Nothing here waits on the Button's own 1s flash (unlike Create/Edit
      // Event's deferred close) — the drawer never closes in this flow, so
      // there's no side effect to hold back; the flash and the reset just
      // play out at the same time.
      setAddedCount((c) => c + 1)
      setLastAddedGuest(guest)
      setProgress('success')
      resetForNextGuest()
    } catch {
      setSubmitError('Could not add this guest — your browser storage may be full.')
      setProgress('idle')
    }
  }

  const bulkCount = importResult && !('error' in importResult) ? importResult.rows.length : 0

  return (
    <DrawerPanelPortal
      open={open}
      onClose={handleClose}
      title="Add guest"
      icon={UserPlusIcon}
      footer={
        mode === 'bulk' ? (
          <>
            <Button variant="ghost" onClick={handleClose}>
              {addedCount > 0 ? 'Done' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              onClick={handleBulkSubmit}
              disabled={!eventId || bulkCount === 0}
              progress={progress}
              onProgressSettle={handleBulkProgressSettle}
            >
              {progress === 'loading' ? 'Importing…' : bulkCount > 0 ? `Import ${bulkCount} guest${bulkCount === 1 ? '' : 's'}` : 'Import'}
            </Button>
          </>
        ) : (
          <>
            {/* "Cancel" stops reading right once a guest has actually been
                saved this run — there's nothing left to cancel, just a
                session to close out. */}
            <Button variant="ghost" onClick={handleClose}>
              {addedCount > 0 ? 'Done' : 'Cancel'}
            </Button>
            {/* `form={formId}` — this button lives in Drawer's separate
                footer slot, outside the <form> element below, so it needs
                the explicit form attribute to still submit it. onProgressSettle
                has nothing to do here (see handleSubmit's own doc) beyond
                resetting the Button back to idle for the next guest. */}
            <Button
              variant="primary"
              type="submit"
              form={formId}
              disabled={!eventId}
              progress={progress}
              onProgressSettle={() => setProgress('idle')}
            >
              {progress === 'loading' ? 'Adding…' : 'Add guest'}
            </Button>
          </>
        )
      }
    >
      <div ref={modeRailRef} className="relative mb-5 inline-flex w-full rounded-xl border border-black/10 bg-black/[0.03] p-1">
        {modeIndicator && (
          <div
            aria-hidden="true"
            className="absolute left-0 top-0 rounded-lg bg-white shadow-sm transition-[transform,width] duration-300 ease-out"
            style={{ width: modeIndicator.width, height: modeIndicator.height, transform: `translate(${modeIndicator.left}px, ${modeIndicator.top}px)` }}
          />
        )}
        <button
          type="button"
          data-tab-key="single"
          onClick={() => {
            setMode('single')
            setProgress('idle')
          }}
          className={`relative z-10 flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            mode === 'single' ? 'text-ink-900' : 'text-ink-900/60 hover:text-ink-900'
          }`}
        >
          One at a time
        </button>
        <button
          type="button"
          data-tab-key="bulk"
          onClick={() => {
            setMode('bulk')
            setProgress('idle')
          }}
          className={`relative z-10 flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            mode === 'bulk' ? 'text-ink-900' : 'text-ink-900/60 hover:text-ink-900'
          }`}
        >
          Bulk import (Excel)
        </button>
      </div>

      {mode === 'bulk' ? (
        <div className="flex flex-col gap-4">
          {/* Drag-and-drop zone, plus a plain browse fallback (the hidden
              file input) — same two-affordances-in-one pattern ImageField's
              own upload control already uses, just with a bigger, dashed
              drop target since dragging a whole file onto this one matters
              more here than for a single photo. */}
          <div
            onDragOver={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault()
              setDragging(false)
              handleImportFile(e.dataTransfer.files?.[0])
            }}
            className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${
              dragging ? 'border-accent-700 bg-accent-700/5' : 'border-black/15 bg-black/[0.02]'
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-700/10 text-accent-700">
              <UploadIcon className="h-5 w-5" />
            </span>
            <span className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-ink-900">Drag an Excel file here</p>
              <InfoTooltip label="Needs a Name column — NetMessage, Email, Role, and Organization come along if present. Imports land unseated and uninvited." />
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 rounded-lg bg-black/5 px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:bg-black/10 active:scale-[0.97]"
            >
              Browse file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleImportFile(e.target.files?.[0])}
            />
            {/* The template an admin's spreadsheet needs to match — a real
                .xlsx file served straight from public/ (Vite serves that
                folder's contents at the site root, unbundled), same
                Blob-free "just an <a download>" mechanism this app already
                uses for exports elsewhere. Not a generated-on-the-fly file:
                a fixed, hand-authored template is what a header-aliases
                match is actually validated against, not whatever this
                session happens to produce. */}
            <a
              href="/guest-import-template.xlsx"
              download
              className="mt-1 flex items-center gap-1 text-xs font-medium text-accent-700 hover:underline"
            >
              <DownloadIcon className="h-3 w-3" />
              Download template
            </a>
          </div>

          {fileName && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-black/5 px-3.5 py-2.5">
              <span className="min-w-0 truncate text-xs font-medium text-ink-900">{fileName}</span>
              <button
                type="button"
                aria-label="Remove file"
                onClick={() => {
                  setFileName(null)
                  setImportResult(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-icon-gray transition hover:bg-black/10 hover:text-ink-900"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </div>
          )}

          {importResult && 'error' in importResult && <p className="text-xs font-medium text-status-declined">{importResult.error}</p>}

          {importResult && !('error' in importResult) && (
            <div className="rounded-xl border border-black/5 p-3.5">
              <p className="text-xs font-semibold text-ink-900">
                {importResult.rows.length} guest{importResult.rows.length === 1 ? '' : 's'} ready to import
                {importResult.skipped > 0 ? ` · ${importResult.skipped} row${importResult.skipped === 1 ? '' : 's'} skipped (no name)` : ''}
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {importResult.rows.slice(0, 6).map((row, i) => (
                  <li key={i} className="truncate text-xs text-muted">
                    {row.name}
                    {row.organization ? ` · ${row.organization}` : ''}
                  </li>
                ))}
                {importResult.rows.length > 6 && <li className="text-xs text-muted">+{importResult.rows.length - 6} more</li>}
              </ul>
            </div>
          )}

          {submitError && <p className="text-xs font-medium text-status-declined">{submitError}</p>}
        </div>
      ) : (
        <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* The "you can keep going" feedback the seamless multi-add flow
              needs — this drawer no longer closes after a successful add
              (see handleSubmit), so without something here, the guest
              landing gave no visible sign beyond a bottom-right Toast that's
              easy to miss with focus already back in this field. The
              guest's own avatar (real photo or their generated face — same
              GuestAvatar every roster row already uses) is what makes this
              read as "that specific person landed," not a generic banner. */}
          {lastAddedGuest && (
            <div className="flex items-center gap-3 rounded-xl border border-status-confirmed/20 bg-status-confirmed/10 px-3.5 py-2.5">
              <GuestAvatar name={lastAddedGuest.name} imageUrl={lastAddedGuest.imageUrl} avatarConfig={lastAddedGuest.avatarConfig} sizeClassName="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{lastAddedGuest.name}</p>
                <p className="text-xs font-medium text-status-confirmed">
                  Added{addedCount > 1 ? ` · ${addedCount} guests this session` : ''}
                </p>
              </div>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-status-confirmed text-white">
                <CheckmarkIcon className="h-3.5 w-3.5" />
              </span>
            </div>
          )}

          {/* Avatar beside Name — already has a live, name-derived generated
              face (GuestAvatarPicker) before anyone's touched Randomize or
              Upload, so this never reads as a blank placeholder waiting to
              be filled in. */}
          <div className="flex items-start gap-3">
            <GuestAvatarPicker
              name={name}
              imageUrl={imageUrl}
              avatarConfig={avatarConfig}
              onImageChange={setImageUrl}
              onAvatarConfigChange={setAvatarConfig}
              sizeClassName="h-16 w-16"
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <LabeledField ref={nameInputRef} label="Name" value={name} onChange={setName} icon={UserIcon} required autoFocus />
            </div>
          </div>

          <FieldGroup
            label="Contact"
            labelExtra={<InfoTooltip label="One of the two is enough. Invites go out later, from Send Invitations." />}
          >
            {/* Stacked, not side-by-side — a 2-col grid read cramped at this
                drawer's own width (labels/placeholders truncating), and
                stacked fields are the easier target on the mobile bottom
                sheet this same drawer becomes below `lg:`. */}
            <div className="flex flex-col gap-4">
              {/* Icon + tint per channel (not two identical boxes) —
                  accent-cyan for WhatsApp, accent-700 (this app's main
                  brand blue, same as Email everywhere else it appears) for
                  Email, so the two fields read apart at a glance. No
                  WhatsApp-green here on purpose — ChatBubbleIcon's own doc
                  explains why this app avoids that brand color. */}
              <LabeledField
                label="NetMessage"
                value={wa}
                icon={ChatBubbleIcon}
                iconClassName="text-accent-cyan"
                onChange={(v) => {
                  setWa(v)
                  setContactError(false)
                }}
              />
              <LabeledField
                label="Email"
                type="email"
                value={email}
                icon={MailIcon}
                iconClassName="text-accent-700"
                onChange={(v) => {
                  setEmail(v)
                  setContactError(false)
                }}
              />
            </div>
            {contactError && (
              <p className="text-xs font-medium text-status-declined">Add a phone number or an email — at least one is needed.</p>
            )}
          </FieldGroup>

          <FieldGroup
            label="Role & organization"
            labelExtra={<InfoTooltip label="Pick from values you've used before — or type a new one." />}
          >
            {/* ComboField — a themed "type or pick" dropdown (GroupedField.tsx),
                not a native <datalist> (unstylable, renders as the OS/
                browser's own bare popup). Options are every already-used
                value (see roleOptions/organizationOptions above); freely
                typing anything else still works. Stacked, same reasoning
                as Contact above. */}
            <div className="flex flex-col gap-4">
              <ComboField label="Role" value={role} onChange={setRole} options={roleOptions} placeholder="e.g. VIP, Speaker, Press" icon={BriefcaseIcon} />
              <ComboField
                label="Organization"
                value={organization}
                onChange={setOrganization}
                options={organizationOptions}
                placeholder="e.g. PT Gamefinity Nusantara"
                icon={BuildingIcon}
              />
            </div>
          </FieldGroup>

          {submitError && <p className="text-xs font-medium text-status-declined">{submitError}</p>}
        </form>
      )}
    </DrawerPanelPortal>
  )
}
