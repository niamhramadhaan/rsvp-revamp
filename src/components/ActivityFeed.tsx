import { useState } from 'react'
import Modal from './Modal'

interface ActivityItem {
  initials: string
  color: string
  text: string
  time: string
}

const ACTIVITY: ActivityItem[] = [
  { initials: 'EK', color: '#303a74', text: 'Ellie joined team developers', time: '04 April 2021 | 04:00 PM' },
  { initials: 'JH', color: '#552CE8', text: 'Jenny joined team HR', time: '04 April 2021 | 04:00 PM' },
  { initials: 'AF', color: '#110f48', text: 'Adam got employee of the month', time: '03 April 2021 | 02:00 PM' },
  { initials: 'RP', color: '#5087A5', text: 'Robert joined team design', time: '02 April 2021 | 02:00 PM' },
  { initials: 'JK', color: '#F9896B', text: 'Jack joined team design', time: '01 April 2021 | 03:00 PM' },
]

const MORE_ACTIVITY: ActivityItem[] = [
  { initials: 'SM', color: '#4F46BA', text: 'Sam moved 3 tasks to Done', time: '31 March 2021 | 05:20 PM' },
  { initials: 'CW', color: '#F9896B', text: 'Carmen commented on Landing Page design', time: '30 March 2021 | 11:10 AM' },
  { initials: 'MT', color: '#5087A5', text: 'Mike joined team developers', time: '29 March 2021 | 09:45 AM' },
]

function ActivityRow({ a }: { a: ActivityItem }) {
  return (
    <div className="flex items-center gap-3.5">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ backgroundColor: a.color }}
      >
        {a.initials}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink-900">{a.text}</p>
        <p className="text-xs text-muted">{a.time}</p>
      </div>
    </div>
  )
}

export default function ActivityFeed() {
  const [viewAllOpen, setViewAllOpen] = useState(false)

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink-900">Activity</h2>
        <button
          type="button"
          onClick={() => setViewAllOpen(true)}
          className="text-sm font-medium text-accent-700 hover:underline"
        >
          View All
        </button>
      </div>

      <ul className="mt-5 flex flex-col gap-5">
        {ACTIVITY.map((a, i) => (
          <li key={i}>
            <ActivityRow a={a} />
          </li>
        ))}
      </ul>

      <Modal open={viewAllOpen} onClose={() => setViewAllOpen(false)} title="All Activity">
        <ul className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1">
          {[...ACTIVITY, ...MORE_ACTIVITY].map((a, i) => (
            <li key={i}>
              <ActivityRow a={a} />
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}
