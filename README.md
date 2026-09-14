# RSVP Revamp

An event RSVP, seating, and check-in dashboard. Admins create events, manage guest lists, build seat maps, send invitations, and check guests in on event day. Staff get a scoped check-in view. Built with React, Vite, Tailwind CSS v4, and TypeScript.

## Features

- **Events** — create, edit, archive, and restore events, each with a banner photo, a customizable uploaded logo (shown in the event switcher and event cards), venue with map pin, and description
- **Guests** — add guests manually or bulk-import from CSV/XLSX, track invite status and RSVP responses
- **Seating** — free-form seat-map canvas with seat categories, quotas, and drag-to-arrange layout blocks
- **Invitations** — per-event invitation templates (message + email variants) sent via WhatsApp or email
- **Check-in** — QR/barcode scanner plus manual code entry, with duplicate-check-in blocking and walk-in handling
- **Reports** — attendance breakdown per seat category, no-shows, walk-ins, and attendance rate
- **Roles** — Admin (full access) and Staff (configurable section and action permissions)

## Getting started

Requires Node.js (see `package.json` engines, if any) and npm.

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build      # production build to dist/
npm run preview    # preview the production build
npm run lint       # oxlint
npm run typecheck  # tsc --noEmit
```

## How data is stored

There is no backend. All records (events, guests, seat maps, users) live in the browser's `localStorage` as JSON, and uploaded images are stored inline as compressed data URLs. This keeps the app fully offline-capable but means storage is limited to the browser quota — uploads are auto-compressed on the way in.

## Project structure

```
src/
  components/        # app shell (DashboardLayout, IconRail, TopHeader), pages, drawers
  components/overview/ # event-dashboard widgets and drawers (guests, seating, check-in, reports)
  components/map/    # venue search + map pin (MapLibre)
  data/              # entity types, store (localStorage), selectors, seed data
  hooks/             # reusable interaction hooks
  utils/             # CSV parsing, image compression, image positioning
```

`plan.md` holds the longer product/design history and decisions.
