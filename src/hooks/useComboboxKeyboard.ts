import { useState, type KeyboardEvent } from 'react'

export interface UseComboboxKeyboardOptions {
  /** How many items are currently showing — the hook clamps/wraps its own
   * highlighted index against this, so a caller never has to reset it by
   * hand just because the suggestion list got shorter mid-navigation. */
  itemCount: number
  open: boolean
  onOpen: () => void
  onClose: () => void
  /** Fires on Enter with a highlighted item, or on Tab/blur leaving a
   * highlighted item behind — either way, "commit to whichever suggestion
   * is currently highlighted." */
  onSelect: (index: number) => void
}

// Real keyboard support for this app's few custom dropdown/combobox
// widgets (ComboField's Role/Organization suggestions, VenueField's place
// search) — both used to be mouse-only (a plain onMouseDown per option,
// nothing on the input itself), which a `<select>` or native `<datalist>`
// never was. One shared hook rather than two near-identical copies of the
// same arrow-key/Enter/Escape bookkeeping.
export function useComboboxKeyboard({ itemCount, open, onOpen, onClose, onSelect }: UseComboboxKeyboardOptions) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        onOpen()
        setHighlightedIndex(itemCount > 0 ? 0 : -1)
        return
      }
      if (itemCount === 0) return
      setHighlightedIndex((i) => (i + 1) % itemCount)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open || itemCount === 0) return
      setHighlightedIndex((i) => (i <= 0 ? itemCount - 1 : i - 1))
      return
    }

    if (e.key === 'Enter') {
      if (open && highlightedIndex >= 0 && highlightedIndex < itemCount) {
        e.preventDefault()
        onSelect(highlightedIndex)
        setHighlightedIndex(-1)
      }
      // No highlighted suggestion — let Enter fall through to the form's
      // own submit instead of swallowing it.
      return
    }

    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        // Stops the Escape from also bubbling up to DrawerPanel's own
        // "close the whole drawer" handler — closing just this dropdown is
        // what a listbox's own Escape convention means.
        e.stopPropagation()
        onClose()
        setHighlightedIndex(-1)
      }
    }
  }

  return { highlightedIndex, setHighlightedIndex, handleKeyDown }
}
