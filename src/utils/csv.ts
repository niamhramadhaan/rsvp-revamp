// Shared CSV helpers — pulled out of ReportsView (the original, and until now
// only, caller) once GuestsView's own bulk "Export selected" needed the exact
// same escaping/download mechanics rather than a second hand-rolled copy.

/** Quotes a cell only if it actually needs it (contains a comma, quote, or
 * newline) — matches how every spreadsheet app reads plain CSV, and keeps
 * the common case (a plain name, a plain status) unquoted and readable. */
export function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Builds a full CSV string (header row + data rows) from plain string[][] —
 * callers are responsible for turning their own domain rows into strings
 * first (see ReportsView's buildGuestsCsv for the guest-specific shape). */
export function buildCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => row.map((cell) => csvCell(String(cell ?? ''))).join(',')).join('\n')
}

// Client-side export only — no backend to talk to (see plan.md), so a Blob +
// object URL is the whole mechanism.
export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
