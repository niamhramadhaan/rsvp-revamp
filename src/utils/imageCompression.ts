// This app has no backend to upload to, so an uploaded photo lives inline in
// the record itself as a base64 data: URL (Event.imageUrl/Guest.imageUrl's
// own doc) — which used to mean a raw phone photo (routinely 5-12MB) went
// straight into localStorage's own per-origin quota (~5-10MB TOTAL, shared
// across every event/guest this app has ever stored). A single photo that
// size could exceed the whole quota on its own, and localStorage.setItem
// throws when it does — which every caller of updateEvent/createGuest/etc.
// awaits without a try/catch, so that throw silently stranded whichever
// drawer was mid-save on its own "Saving…" state forever (see each
// drawer's own handleSubmit for the belt-and-suspenders fix on that side).
// The real fix belongs here though: resize to a sane on-screen resolution
// and re-encode as JPEG *before* this ever reaches onChange, so the stored
// string stays predictably small (typically under a few hundred KB)
// regardless of how large the original photo was.
//
// Its own file (not living inside GroupedField.tsx, where it started) so
// that module can stay component-only — a mixed component/plain-function
// export is exactly what breaks Vite's fast-refresh boundary (oxlint's
// react(only-export-components) rule), and GuestAvatar.tsx's own
// GuestAvatarPicker needs this exact pipeline too, not a second copy of it.
export const DEFAULT_MAX_DIMENSION = 1600
const JPEG_QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4]
// ~700KB of actual image bytes — comfortably inside the shared quota even
// after base64's own ~33% overhead, and after several guest photos plus one
// event banner have already been stored alongside it.
const STORED_BYTE_BUDGET = 700 * 1024

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('decode-failed'))
    }
    img.src = objectUrl
  })
}

// Resizes to fit within maxDimension (never upscales a smaller image) and
// re-encodes as JPEG, stepping quality down until the result fits
// STORED_BYTE_BUDGET or the lowest quality step is reached — a photo this
// app can always afford to store, no matter how large the original upload
// was. Filled white first: a transparent PNG dropped straight onto an
// unpainted canvas would otherwise re-encode with black where the
// transparency was, since JPEG has no alpha channel of its own.
export async function compressImage(file: File, maxDimension: number): Promise<string> {
  const img = await loadImage(file)
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no-canvas-context')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  let dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY_STEPS[0])
  for (const quality of JPEG_QUALITY_STEPS) {
    dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (dataUrl.length <= STORED_BYTE_BUDGET * 1.4) break // *1.4: rough base64-over-raw-bytes ratio
  }
  return dataUrl
}
