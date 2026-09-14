import { useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from './icons/UiIcons'
import { useCurrentEvent } from '../data/hooks'

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH_LABEL: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }

type CalendarCell = number | null

function buildWeeks(year: number, month: number): CalendarCell[][] {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: CalendarCell[] = [...Array(firstDay).fill(null), ...Array(daysInMonth)].map((_, i) =>
    i < firstDay ? null : i - firstDay + 1
  )
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: CalendarCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export default function CalendarCard() {
  const today = useMemo(() => new Date(), [])
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  // Same "current event" every other widget reads (EventSwitcher, EventBanner)
  // — this calendar used to be a plain generic month grid with no idea which
  // date actually mattered to the user, which is exactly the gap an
  // event-scoped app's own calendar widget shouldn't have.
  const [currentEvent] = useCurrentEvent()

  const weeks = useMemo(
    () => buildWeeks(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  )

  const isCurrentMonth =
    viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth()

  const eventDate = currentEvent ? new Date(currentEvent.date) : null
  const isEventMonth =
    eventDate !== null && eventDate.getFullYear() === viewDate.getFullYear() && eventDate.getMonth() === viewDate.getMonth()

  function changeMonth(delta: number) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  // Jumps the grid straight to whichever month the current event falls in —
  // the one navigation shortcut worth having here, since "where's my event"
  // is the actual question this widget exists to answer.
  function jumpToEvent() {
    if (!eventDate) return
    setViewDate(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1))
  }

  return (
    <div>
      {currentEvent && (
        <button
          type="button"
          onClick={jumpToEvent}
          className="mb-3 flex w-full items-center gap-2 rounded-xl bg-accent-700/10 px-3 py-2 text-left transition hover:bg-accent-700/15 active:scale-[0.98]"
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-accent-700" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-accent-700">{currentEvent.name}</span>
          <span className="shrink-0 text-xs font-semibold text-accent-700">
            {eventDate?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </button>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-900">
          {viewDate.toLocaleDateString(undefined, MONTH_LABEL)}
        </p>
        <div className="flex items-center gap-3 text-ink-900/60">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
            className="transition hover:text-ink-900 active:scale-[0.9]"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
            className="transition hover:text-ink-900 active:scale-[0.9]"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <table className="mt-4 w-full border-separate border-spacing-y-1.5 text-center">
        <thead>
          <tr>
            {DAYS.map((d) => (
              <th key={d} className="pb-1 text-[10px] font-semibold text-muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={i}>
              {week.map((day, j) => {
                const isToday = isCurrentMonth && day === today.getDate()
                const isEventDay = isEventMonth && day === eventDate!.getDate()
                return (
                  <td key={j} className="py-0.5">
                    {day && (
                      <span
                        className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                          isToday
                            ? 'bg-ink-900 text-white'
                            : isEventDay
                              ? 'font-semibold text-accent-700 ring-2 ring-inset ring-accent-700'
                              : 'text-ink-900/80'
                        }`}
                      >
                        {day}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {isEventMonth && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-inset ring-accent-700" />
          {currentEvent?.name}
        </p>
      )}
    </div>
  )
}
