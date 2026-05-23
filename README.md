# CoasterBusForU

A real-time digital ticketing and fleet management system for student coaster bus transport in Romanbul, Oriental Mindoro. Built with a FIFO queue model, live GPS tracking, QR-based boarding, and role-based access for students, conductors, drivers, and operators.

---

## Features

### Student
- Book a seat on any available coaster across 6 bidirectional routes
- FIFO queue — seat assigned in booking order, overflow auto-queued
- QR code ticket for conductor scanning at boarding
- Live seat map showing occupied and available seats
- Real-time ticket status updates (queued → confirmed → boarded → completed)
- Cancel ticket with automatic seat counter decrement
- ETA alerts and proximity notifications when the bus approaches your pickup point
- Save highway pickup location in profile for proximity alerts
- Direction picker (origin → destination) to filter buses by route

### Conductor
- QR code scanner (camera) to board passengers
- Manual ticket code entry as fallback
- Manifest view with passenger names, seat numbers, payment status
- Verify cash/GCash payments
- Mark passengers as boarded, completed, or no-show
- Seat map with color-coded status per seat

### Driver
- Claim an assigned bus
- Broadcast live GPS location (persists across page navigation)
- Set bus status: idle → boarding → in_transit → arrived
- Set ETA in minutes
- Passenger pickup map showing highway pickup points
- Boarding notification sent to all ticket holders when status → boarding
- Auto-complete all boarded tickets and reset seat counter when status → arrived
- Session resets on sign-out or account switch (no state leakage between drivers)

### Admin / Operator
- Operations dashboard with live KPIs (active tickets, queue depth, capacity)
- Fleet tab: manage all buses, assign drivers and conductors, set ETA, update status, edit fare, set GCash number, reassign bus to any route
- Routes tab: view all 6 routes, edit fare per route, see which buses are assigned
- Staff management: create driver/conductor accounts, remove roles, view assignments

---

## Routes

All 3 corridors operate in both directions:

| Bus | Route | Fare |
|-----|-------|------|
| CBF-001 | Mansalay → Roxas | ₱60 |
| CBF-002 | Roxas → Bulalacao | ₱80 |
| CBF-003 | Mansalay → Bulalacao | ₱50 |
| CBF-004 | Roxas → Mansalay | ₱60 |
| CBF-005 | Bulalacao → Roxas | ₱80 |
| CBF-006 | Bulalacao → Mansalay | ₱50 |

Fares are editable by the admin at any time without redeploying.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TanStack Start (Vite) |
| Routing | TanStack Router (file-based) |
| Database | Firebase Firestore (real-time) |
| Auth | Firebase Authentication |
| Styling | Tailwind CSS v4 + Radix UI |
| Maps | Leaflet + OpenStreetMap |
| QR Scanning | html5-qrcode |
| QR Generation | qrcode.react |
| Notifications | Firestore `notifications` collection + browser Notification API |
| GPS | Browser Geolocation API → Firestore `buses/{id}.currentLat/Lng` |
| Package manager | npm / bun |

---

## Project Structure

```
src/
├── components/
│   ├── AppNav.tsx              # Top navigation bar
│   ├── PageShell.tsx           # Layout wrapper
│   ├── commuter/               # Student-facing UI components
│   │   ├── CrowdBadge.tsx
│   │   ├── FavoriteBusButton.tsx
│   │   ├── QueueWaitEstimate.tsx
│   │   └── ShareTicketButton.tsx
│   ├── driver/
│   │   └── DriverPickupMap.tsx # Map of highway pickup stops
│   └── ui/                     # shadcn/ui component library
├── contexts/
│   └── driver-location.tsx     # GPS sharing context (survives navigation)
├── hooks/
│   ├── use-auth.ts             # Firebase auth + roles
│   ├── use-bus-pickup-stops.ts # Highway pickup data for driver map
│   ├── use-favorite-bus.ts     # Pinned bus preference
│   └── use-unread-count.ts     # Notification badge count
├── integrations/
│   └── firebase/index.ts       # Firestore + Auth instances
├── lib/
│   ├── tickets.functions.ts    # bookTicket, cancelTicket, verifyPayment
│   ├── commuter.ts             # Bus sorting logic
│   ├── ux.ts                   # Status badge config, availability levels
│   └── utils.ts                # cn() helper
└── routes/
    ├── index.tsx               # Landing page
    ├── book.tsx                # Booking flow (list → pickup → seat → payment → confirm)
    ├── tickets.tsx             # My Tickets with QR codes
    ├── tracking.tsx            # Live map with proximity alerts
    ├── notifications.tsx       # ETA alerts inbox
    ├── profile.tsx             # Student/staff profile + pickup location
    ├── conductor.tsx           # Conductor console
    ├── driver.tsx              # Driver console
    ├── admin.tsx               # Operations dashboard
    └── login.tsx               # Firebase email/password auth

scripts/
└── seed-firestore.mjs          # Seeds routes, buses, staff accounts

firestore.rules                 # Firestore security rules
```

---

## Data Model

### `buses/{busId}`
```
plateNumber:        string
routeId:            string          → ref to routes/{routeId}
capacity:           number          (default 14)
status:             "idle" | "boarding" | "in_transit" | "arrived"
etaMinutes:         number
currentLat:         number | null
currentLng:         number | null
driverId:           string | null   → ref to users/{uid}
conductorId:        string | null   → ref to users/{uid}
activeTicketCount:  number          (atomic counter, drives seat display)
departureTime:      string | null
```

### `routes/{routeId}`
```
name:         string   e.g. "Mansalay → Roxas"
origin:       string   e.g. "Mansalay, Oriental Mindoro"
destination:  string
fare:         number
originLat/Lng, destLat/Lng: number
```

### `tickets/{ticketId}`
```
userId:         string
busId:          string
ticketCode:     string   (8-char random, e.g. "A1B2C3D4")
queuePosition:  number
seatNumber:     number | null
preferredSeat:  number | null
status:         "queued" | "confirmed" | "boarded" | "completed" | "cancelled"
pickupType:     "highway" | "terminal"
paymentMethod:  "cash" | "gcash"
paymentStatus:  "pending" | "paid"
createdAt:      timestamp
```

### `users/{uid}`
```
email, fullName, studentId, phone: string
roles:      string[]   ["student"] | ["driver"] | ["conductor"] | ["admin"]
pickupLat:  number | null   (student highway pickup location)
pickupLng:  number | null
```

### `notifications/{notifId}`
```
userId:    string
title:     string
message:   string
read:      boolean
createdAt: timestamp
```

---

## Getting Started

### Prerequisites
- Node.js 18+ or Bun
- A Firebase project with Firestore and Authentication enabled

### 1. Clone and install

```bash
git clone https://github.com/zlugl/CoasterBus.git
cd CoasterBus
npm install
```

### 2. Configure Firebase

Create a `.env` file in the project root (never commit this):

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Publish Firestore security rules

Copy the contents of `firestore.rules` and publish them in:
**Firebase Console → Firestore → Rules → Publish**

### 4. Seed the database

Download a service account key from **Firebase Console → Project Settings → Service Accounts → Generate new private key** and save it as `scripts/serviceAccountKey.json` (this file is gitignored).

```bash
node scripts/seed-firestore.mjs
```

This creates:
- 6 routes (all 3 corridors × 2 directions)
- 6 buses (CBF-001 through CBF-006)
- 3 staff accounts:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@coasterbus.app | Admin@2026 |
| Driver | driver@coasterbus.app | Driver@2026 |
| Conductor | conductor@coasterbus.app | Conductor@2026 |

> Change these passwords after first sign-in.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

---

## Role Access

| Page | Student | Conductor | Driver | Admin |
|------|---------|-----------|--------|-------|
| `/book` | ✅ | — | — | — |
| `/tickets` | ✅ | — | — | — |
| `/tracking` | ✅ | ✅ | ✅ | ✅ |
| `/notifications` | ✅ | ✅ | ✅ | ✅ |
| `/profile` | ✅ | ✅ | ✅ | ✅ |
| `/conductor` | — | ✅ | — | ✅ |
| `/driver` | — | — | ✅ | ✅ |
| `/admin` | — | — | — | ✅ |

New sign-ups default to the `student` role. Staff accounts are created by the admin from the Operations dashboard.

---

## Notification Flow

```
Student saves pickup location (Profile page)
        ↓
Driver claims bus → starts GPS sharing
        ↓
Driver sets status → "boarding"
  → Firestore notification written to all confirmed/queued ticket holders
  → Bell badge updates in real time
        ↓
Bus moves (GPS ticks every ~5s)
  → For each highway pickup ticket holder with a saved location:
      if distance(bus, student.pickupLocation) ≤ 1.5 km
        → Write "Bus approaching" notification (once per trip)
        ↓
Driver sets status → "arrived"
  → All boarded tickets auto-completed
  → activeTicketCount resets to 0
  → Seats become available for next trip
```

---

## License

MIT
