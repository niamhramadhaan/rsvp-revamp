# RSVP & Check-in Flow

Reflects the actual codebase: this app has no guest-facing RSVP page — invitations go out
one-way (WhatsApp/NetMessage or Email) and the loop closes physically at the door via staff
check-in. `rsvpStatus` exists on `Guest` but is vestigial (no real flow writes it).

Stages used across the UI: `not_invited → invited → checked_in` (`getGuestStage`,
`src/data/selectors.ts`).

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "fontFamily": "Poppins, \"Segoe UI\", sans-serif",
    "primaryColor": "#eaf3fb",
    "primaryBorderColor": "#2e86c1",
    "primaryTextColor": "#101e33",
    "lineColor": "#4d90c2",
    "secondaryColor": "#f8f1e4",
    "tertiaryColor": "#fbfdff",
    "clusterBkg": "#f6f9fc",
    "clusterBorder": "#dceaf7",
    "edgeLabelBackground": "#fbfdff"
  }
}}%%
flowchart TD

  classDef admin fill:#eaf3fb,stroke:#0060a8,stroke-width:1.5px,color:#101e33;
  classDef staff fill:#e3effa,stroke:#2e86c1,stroke-width:1.5px,color:#101e33;
  classDef guest fill:#f8f1e4,stroke:#a3540f,stroke-width:1.5px,color:#101e33;
  classDef system fill:#fbfdff,stroke:#b7c3ce,stroke-width:1.5px,color:#3b6288,stroke-dasharray: 3 3;
  classDef confirmed fill:#eafaf3,stroke:#106647,stroke-width:1.5px,color:#106647;
  classDef pending fill:#fdf6e3,stroke:#8a6414,stroke-width:1.5px,color:#8a6414;
  classDef declined fill:#fbeceb,stroke:#b8362b,stroke-width:1.5px,color:#b8362b;

  subgraph ADMIN["👤 Admin"]
    A1["Create event &amp;<br/>build guest roster"]
    A2["Author invitation template<br/><i>WA message / Email HTML</i>"]
  end

  subgraph SYSTEM["⚙️ System"]
    S1["Generate invite code<br/>per guest"]
    S2["Send via WA / Email"]
    S3["Stage: invited"]
  end

  subgraph GUEST["🎟️ Guest"]
    G1["Receives invite"]
    G2["Arrives at venue<br/>with invite code"]
  end

  subgraph STAFF["🧑‍💼 Staff"]
    T1["Send invitations"]
    T2["Assign seat"]
    T3["Scan / check in guest"]
    T4["Print badge"]
  end

  A1 --> A2 --> T1
  T1 --> S1 --> S2 --> G1 --> S3
  A1 -.-> T2
  G1 --> G2 --> T3
  T3 --> DONE["✅ Checked in"]:::confirmed --> T4

  class A1,A2 admin;
  class T1,T2,T3,T4 staff;
  class G1,G2 guest;
  class S1,S2,S3 system;
```

## End-to-end scenario — Minicinema Press Conference

Real-case walkthrough for one event, full ecosystem: admin → messaging provider →
journalist's phone → ticket redemption → door check-in → badge → post-event reporting.

> **Scope note:** the invite-send, check-in, seat-assign and report steps are the real,
> implemented flow (`SendInvitationsDrawer`, `CheckInDrawer`, `checkin.ts`, `ReportsView`).
> The **sltr.id redemption microsite** (guest self-service RSVP + digital ticket) is not in
> this codebase today — it's drawn here as the target/real-world flow this diagram was asked
> to model, since it's the piece that actually closes the loop between "invite sent" and
> "guest shows up with a valid ticket." Treat that lane as proposed, everything else as built.

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "fontFamily": "Poppins, \"Segoe UI\", sans-serif",
    "primaryColor": "#eaf3fb",
    "primaryBorderColor": "#2e86c1",
    "primaryTextColor": "#101e33",
    "lineColor": "#4d90c2",
    "secondaryColor": "#f8f1e4",
    "tertiaryColor": "#fbfdff",
    "actorBkg": "#fbfdff",
    "actorBorder": "#2e86c1",
    "actorTextColor": "#101e33",
    "signalColor": "#101e33",
    "signalTextColor": "#101e33",
    "labelBoxBkgColor": "#eaf3fb",
    "labelBoxBorderColor": "#2e86c1",
    "labelTextColor": "#101e33",
    "loopTextColor": "#3b6288",
    "activationBorderColor": "#b7c3ce",
    "activationBkgColor": "#eaf3fb",
    "sequenceNumberColor": "#ffffff",
    "noteBkgColor": "#f8f1e4",
    "noteBorderColor": "#a3540f",
    "noteTextColor": "#101e33"
  }
}}%%
sequenceDiagram
  autonumber
  actor Admin as Admin (Organizer)
  participant Dash as Dashboard (this app)
  participant WA as NetMessage / WhatsApp
  actor Press as Guest (Journalist/Press)
  participant Sltr as sltr.id (redemption site)
  participant DB as Store (guest records)
  actor Staff as Staff (door)
  participant Scan as QR Scanner
  participant Badge as Printed Badge

  rect rgba(234,243,251,0.5)
  Note over Admin,DB: Pre-event setup
  Admin->>Dash: Create event "Minicinema Press Conference"
  Admin->>Dash: Import press/media roster (bulk Excel)
  Dash->>DB: generate invite token per guest (e.g. QRT-92F)
  Admin->>Dash: Author WA template incl. sltr.id/{token} link
  end

  rect rgba(227,239,250,0.5)
  Note over Admin,Press: Sending invitations
  Admin->>Dash: Send invitations (channel: WA)
  Dash->>WA: dispatch batch
  Dash->>DB: mark invites.wa = sent
  WA->>Press: "You're invited — Minicinema Press Conference.<br/>Redeem your pass: sltr.id/QRT-92F"
  end

  rect rgba(248,241,228,0.5)
  Note over Press,DB: Guest redeems ticket (self-service)
  Press->>Sltr: open sltr.id/QRT-92F on phone
  Sltr->>DB: lookup token QRT-92F
  DB-->>Sltr: event details + guest profile
  Sltr-->>Press: show event card + "Konfirmasi Kehadiran"
  Press->>Sltr: tap Accept
  Sltr->>DB: rsvpStatus = accepted, ticket redeemed
  Sltr-->>Press: digital QR ticket (save to phone/wallet)
  end

  rect rgba(227,239,250,0.5)
  Note over Press,Badge: Event day — door check-in
  Press->>Staff: arrives at venue, shows QR ticket
  Staff->>Scan: scan QR (CheckInDrawer)
  Scan->>Dash: decoded token
  Dash->>DB: checkInGuest() stamps checkedInAt/By
  Staff->>Badge: print boarding-pass badge
  Badge-->>Press: hand badge, enter press conference
  end

  rect rgba(234,243,251,0.5)
  Note over Admin,Dash: Post-event
  Admin->>Dash: open Reports
  Dash-->>Admin: funnel — invited / redeemed / declined / checked-in, by outlet
  end
```

## Actors

| Actor | Role in flow |
|---|---|
| **Admin** | Creates event, builds roster, authors invite templates, sets staff permissions |
| **Staff** | Sends invites, assigns seats, runs door check-in (scan/search → confirm → print) |
| **Guest / Invitee** | Passive record — receives invite, shows up with invite code, never replies electronically |
| **System** | Local-only (`localStorage`); generates codes, stamps invite/check-in status; NetMessage & Mailgun are config stubs, not live integrations |

## Notes
- No guest ever RSVPs "yes/no" back into the system — `rsvpStatus` (`accepted/unsure/declined`) is unused by any real flow.
- Seat assignment and invitation sending are independent tracks that only converge at the door: check-in requires a seat, not necessarily a prior invite (walk-ins are flagged informationally via `wasWalkIn`).
- Check-in is idempotent — `checkInGuest()` no-ops if `checkedInAt` is already set.
