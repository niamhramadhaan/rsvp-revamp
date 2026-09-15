import { useId, useRef, useState, type FormEvent } from 'react'
import DrawerPanelPortal from '../DrawerPanelPortal'
import Button, { type ButtonProgress } from '../Button'
import { LabeledTextArea, FieldGroup, BannerImageField } from '../GroupedField'
import { InfoTooltip } from '../Tooltip'
import { updateInvitationTemplate } from '../../data/events'
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator'
import { playSound } from '../../utils/sound'
import { UploadIcon, CloseIcon, MailIcon } from '../icons/UiIcons'
import type { Event } from '../../data/types'

export interface InvitationTemplateDrawerProps {
  event: Event | null
  onClose: () => void
  onSaved?: (event: Event) => void
}

type TemplateMode = 'message' | 'email'

// This app has no PDF-compression equivalent to compressImage (image-only),
// so a real attachment can be considerably larger than any other single
// field this app stores inline — capped well under localStorage's own
// practical quota (~5-10MB) rather than letting one attachment risk the
// whole event record (and everything else sharing that browser's storage).
const PDF_MAX_BYTES = 3 * 1024 * 1024

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// The invitation an event's whole guest list gets, uniformly (not each
// guest's own generated ticket — see Guest.token's own doc for what
// replaced that). Two variants, saved together (an event can have both, or
// either, or neither) — the mode toggle only switches which one is being
// edited right now, same "one shared save, a toggle just changes the
// visible section" shape SendInvitationsDrawer's own channel picker uses.
// Opened from EditEventDrawer's own "Invitation template" button — see that
// file's own doc for why this is a separate drawer rather than a tab
// bolted onto that form (the seat-map template picker set the precedent).
export default function InvitationTemplateDrawer({ event, onClose, onSaved }: InvitationTemplateDrawerProps) {
  const formId = useId()
  const [progress, setProgress] = useState<ButtonProgress>('idle')

  return (
    <DrawerPanelPortal
      open={Boolean(event)}
      onClose={onClose}
      title="Invitation template"
      icon={MailIcon}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} progress={progress} onProgressSettle={() => setProgress('idle')}>
            {progress === 'loading' ? 'Saving…' : 'Save template'}
          </Button>
        </>
      }
    >
      {/* Keyed by event.id — same "remounts fresh per event" reasoning
          EditEventDrawer's own EditEventFields uses. */}
      {event && <TemplateFields key={event.id} formId={formId} event={event} onProgress={setProgress} onSaved={onSaved} onClose={onClose} />}
    </DrawerPanelPortal>
  )
}

function TemplateFields({
  formId,
  event,
  onProgress,
  onSaved,
  onClose,
}: {
  formId: string
  event: Event
  onProgress: (progress: ButtonProgress) => void
  onSaved?: (event: Event) => void
  onClose: () => void
}) {
  const tpl = event.invitationTemplate
  const [mode, setMode] = useState<TemplateMode>('message')
  const modeRailRef = useRef<HTMLDivElement>(null)
  const modeIndicator = useSlidingIndicator(modeRailRef, mode)

  const [bannerImageUrl, setBannerImageUrl] = useState(tpl?.message?.bannerImageUrl)
  const [bannerFocalPoint, setBannerFocalPoint] = useState(tpl?.message?.bannerFocalPoint)
  const [bodyText, setBodyText] = useState(tpl?.message?.bodyText ?? '')
  const [pdfDataUrl, setPdfDataUrl] = useState(tpl?.message?.pdfDataUrl)
  const [pdfFileName, setPdfFileName] = useState(tpl?.message?.pdfFileName)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const [html, setHtml] = useState(tpl?.email?.html ?? '')

  const [error, setError] = useState<string | null>(null)

  async function handlePdfPick(file: File | undefined) {
    if (!file) return
    if (file.type !== 'application/pdf') {
      playSound('error')
      setPdfError('Choose a PDF file.')
      return
    }
    if (file.size > PDF_MAX_BYTES) {
      playSound('error')
      setPdfError(`That PDF is too big (max ${Math.round(PDF_MAX_BYTES / 1024 / 1024)}MB) — this app stores it inline, and a bigger file risks hitting your browser's own storage limit.`)
      return
    }
    setPdfError(null)
    setPdfDataUrl(await readFileAsDataUrl(file))
    setPdfFileName(file.name)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    onProgress('loading')
    try {
      const updated = await updateInvitationTemplate(event.id, {
        message: { bannerImageUrl, bannerFocalPoint, bodyText: bodyText.trim(), pdfDataUrl, pdfFileName },
        email: { html },
      })
      if (updated) onSaved?.(updated)
      onProgress('success')
      onClose()
    } catch {
      playSound('error')
      setError('Could not save — your browser storage may be full.')
      onProgress('idle')
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div ref={modeRailRef} className="relative inline-flex w-full rounded-xl border border-black/10 bg-black/[0.03] p-1">
        {modeIndicator && (
          <div
            aria-hidden="true"
            className="absolute left-0 top-0 rounded-lg bg-white shadow-sm transition-[transform,width] duration-300 ease-out"
            style={{ width: modeIndicator.width, height: modeIndicator.height, transform: `translate(${modeIndicator.left}px, ${modeIndicator.top}px)` }}
          />
        )}
        <button
          type="button"
          data-tab-key="message"
          onClick={() => {
            if (mode !== 'message') playSound('select')
            setMode('message')
          }}
          className={`relative z-10 flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            mode === 'message' ? 'text-ink-900' : 'text-ink-900/60 hover:text-ink-900'
          }`}
        >
          NetMessage
        </button>
        <button
          type="button"
          data-tab-key="email"
          onClick={() => {
            if (mode !== 'email') playSound('select')
            setMode('email')
          }}
          className={`relative z-10 flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            mode === 'email' ? 'text-ink-900' : 'text-ink-900/60 hover:text-ink-900'
          }`}
        >
          Email
        </button>
      </div>

      {mode === 'message' ? (
        <FieldGroup
          label="NetMessage"
          labelExtra={<InfoTooltip label="What every guest gets for this event." />}
        >
          <div className="flex flex-col gap-4">
            <BannerImageField
              label="Banner"
              value={bannerImageUrl}
              onChange={setBannerImageUrl}
              focalPoint={bannerFocalPoint}
              onFocalPointChange={setBannerFocalPoint}
            />
            {/* !bg-black/[0.03] — not FIELD_INPUT's own default white; the
                same transparent neutral tint FieldGroup's own card already
                uses (i.e. the surface this field is sitting on), rather
                than a plain white box or an off-theme blue tint. */}
            <LabeledTextArea label="Message text" value={bodyText} onChange={setBodyText} rows={5} maxLength={1000} className="!bg-black/[0.03]" />

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-ink-900">Attachment (PDF, optional)</span>
              {pdfFileName ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-black/5 px-3.5 py-2.5">
                  <span className="min-w-0 truncate text-xs font-medium text-ink-900">{pdfFileName}</span>
                  <button
                    type="button"
                    aria-label="Remove PDF"
                    onClick={() => {
                      setPdfDataUrl(undefined)
                      setPdfFileName(undefined)
                    }}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-icon-gray transition hover:bg-black/10 hover:text-ink-900"
                  >
                    <CloseIcon className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 bg-black/[0.02] px-4 py-3 text-sm font-medium text-ink-900 transition hover:bg-black/[0.04]">
                  <UploadIcon className="h-4 w-4 text-accent-700" />
                  Attach a PDF
                  <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handlePdfPick(e.target.files?.[0])} />
                </label>
              )}
              {pdfError && <p className="text-xs font-medium text-status-declined">{pdfError}</p>}
            </div>
          </div>
        </FieldGroup>
      ) : (
        <FieldGroup label="Email" labelExtra={<InfoTooltip label="Sent as raw HTML, exactly as typed." />}>
          <LabeledTextArea label="HTML" value={html} onChange={setHtml} rows={12} className="!bg-black/[0.03] font-mono text-xs" />
        </FieldGroup>
      )}

      {error && <p className="rounded-xl bg-status-declined/10 px-3.5 py-2.5 text-xs font-medium text-status-declined">{error}</p>}
    </form>
  )
}
