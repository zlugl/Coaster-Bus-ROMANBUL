# CoasterBusForU — User Manual

**Version:** 2026 · Romanbul, Oriental Mindoro

This manual covers how to use CoasterBusForU for every type of user: students, conductors, drivers, and administrators. Read only the section that applies to your role.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Student Guide](#2-student-guide)
3. [Conductor Guide](#3-conductor-guide)
4. [Driver Guide](#4-driver-guide)
5. [Admin / Operator Guide](#5-admin--operator-guide)
6. [Notifications & Alerts](#6-notifications--alerts)
7. [Live Tracking Map](#7-live-tracking-map)
8. [Installing the App (PWA)](#8-installing-the-app-pwa)
9. [Frequently Asked Questions](#9-frequently-asked-questions)

---

## 1. Getting Started

### Accessing the App

Open your browser and go to the CoasterBusForU URL provided by your school or operator. The app works on any device — phone, tablet, or desktop.

### Creating an Account

1. Tap **Sign in** on the home page.
2. Enter your email address and password.
3. If you are a new student, your account is created automatically with the **student** role.
4. Staff accounts (conductor, driver, admin) are created by the administrator — you cannot self-register as staff.

### Completing Your Profile (Students)

Before you can book a ticket, you must complete your profile:

1. Tap **Profile** in the navigation bar.
2. Fill in your **Full name** — this must match your school ID exactly.
3. Fill in your **Student ID** — this is printed on your QR code ticket.
4. Optionally add your **Phone number**.
5. Optionally save your **Highway pickup location** (see Section 2.4).
6. Tap **Save profile**.

> Your name and student ID appear on your QR code. The conductor uses these to verify your identity when you board.

---

## 2. Student Guide

### 2.1 Booking a Seat

1. Tap **Book** in the navigation bar.
2. Select your **Origin** and **Destination** from the dropdowns (e.g. Mansalay → Roxas).
3. The available buses for that route are shown. Each card displays:
   - Bus plate number and route
   - Fare price
   - Seat map (filled squares = taken, empty = available)
   - Number of seats remaining
   - ETA in minutes
   - Bus status (Idle / Boarding / In transit / Arrived)
4. Tap **Book seat** on the bus you want.

**What the bus statuses mean:**

| Status | Meaning | What to do |
|--------|---------|------------|
| **Idle** | Bus is waiting, not yet boarding | You can book — wait for boarding to start |
| **Boarding** | Bus is at the stop accepting passengers | Go to the bus now |
| **In transit** | Bus is currently on the road | Bus is moving — check ETA |
| **Arrived** | Bus has reached the destination | Trip ended — wait for next departure |

### 2.2 The Booking Flow

After tapping **Book seat**, you go through four steps:

**Step 1 — Pickup type**
- **Highway pick-up** — Wait on the highway at your location. The bus will stop for you.
- **Terminal boarding** — Go to the terminal and board from there.

**Step 2 — Preferred seat**
- Tap a seat number to request it, or tap **No preference — assign automatically**.
- Seats are assigned in FIFO (first-come, first-served) order. Your preferred seat is a request, not a guarantee.

**Step 3 — Payment method**
- **Cash on board** — Pay the conductor in cash when you board.
- **GCash** — Send the exact fare to the GCash number shown before boarding. The conductor will verify your payment.

**Step 4 — Confirm**
- Review your booking details and tap **Confirm booking**.
- You will be redirected to **My Tickets** where your ticket appears immediately.

### 2.3 Understanding Your Ticket

Go to **My Tickets** to see all your tickets. Each ticket shows:

- **Ticket code** — 8-character code (e.g. `A1B2C3D4`)
- **Seat number** or **Queue position** — if the bus was full when you booked, you are placed in the FIFO queue
- **Route** — origin and destination
- **Boarding type** — Highway or Terminal
- **Payment status** — Not yet paid / Paid
- **Bus ETA** — updates in real time
- **QR code** — tap the QR icon to expand it; show this to the conductor when boarding

**Ticket statuses:**

| Status | Meaning |
|--------|---------|
| **Confirmed** | Seat assigned, ready to board |
| **Queued** | Bus was full — you are in the waiting queue |
| **Boarded** | Conductor has scanned you onto the bus |
| **Completed** | You have arrived at your destination |
| **Cancelled** | Ticket was cancelled (by you or marked no-show) |

### 2.4 Highway Pickup Location

If you board from the highway (not the terminal), you can save your GPS location so the app alerts you when the bus is approaching.

1. Go to **Profile**.
2. Under **Highway pickup location**, tap **Use my current location**.
3. Allow location access when prompted.
4. Tap **Save profile**.

Once saved, you will receive a notification in the **Alerts** tab when the bus is within 1.5 km of your saved location.

### 2.5 Cancelling a Ticket

1. Go to **My Tickets**.
2. Find the ticket you want to cancel.
3. Tap **Cancel**.

> You can only cancel tickets with status **Confirmed** or **Queued**. Boarded or completed tickets cannot be cancelled.

---

## 3. Conductor Guide

The conductor console is used to validate boarding, verify payments, and manage the passenger manifest.

### 3.1 Accessing the Conductor Console

1. Sign in with your conductor account.
2. Tap **Conduct** in the navigation bar.
3. Select the bus you are assigned to from the **Bus** dropdown.

### 3.2 Boarding a Passenger

**Method 1 — QR Code Scan (recommended)**
1. Tap **Scan QR** to open the camera.
2. Point the camera at the student's QR code on their phone.
3. The system automatically finds the ticket and marks the passenger as **Boarded**.
4. Tap **Stop camera** when done.

**Method 2 — Manual ticket code**
1. Ask the student for their 8-character ticket code (e.g. `A1B2C3D4`).
2. Type it into the **Ticket code** field.
3. Press **Enter** or tap **Board**.

### 3.3 Verifying Payment

For students who paid by GCash, you must verify their payment:

1. Find the passenger in the manifest table.
2. If their payment shows **Pending**, tap **Verify payment**.
3. The ticket status updates to **Confirmed** and payment shows **Paid**.

### 3.4 The Manifest

The manifest table shows all passengers on the selected bus:

| Column | Description |
|--------|-------------|
| # | Queue position (boarding order) |
| Passenger | Full name and student ID |
| Code | Ticket code |
| Seat | Assigned seat number |
| Boarding | Highway or Terminal |
| Payment | Cash/GCash and Paid/Pending |
| Status | Current ticket status |
| Actions | Board, Verify payment, Complete, No-show |

**Action buttons:**
- **Board** — manually mark a passenger as boarded (use if QR scan fails)
- **Verify payment** — confirm GCash payment received
- **Complete** — mark a highway passenger as arrived at their stop (frees their seat)
- **No-show** — mark a passenger who did not board (cancels their ticket)

### 3.5 Seat Map

The seat map at the top of the console shows a visual overview of all seats:

- **Blue** — confirmed (booked, not yet boarded)
- **Green** — boarded or completed
- **Red strikethrough** — cancelled

### 3.6 Summary Counters

Five counters at the top show live counts:
- **Confirmed** — booked and ready to board
- **Boarded** — currently on the bus
- **Queued** — waiting for a seat
- **Cancelled** — no-shows and cancellations
- **Pending payment** — passengers who haven't paid yet (shown in orange as a warning)

---

## 4. Driver Guide

The driver console is used to claim your assigned bus, broadcast your GPS location, and update the bus status.

### 4.1 Accessing the Driver Console

1. Sign in with your driver account.
2. Tap **Drive** in the navigation bar.

### 4.2 Claiming Your Bus

1. You will see a list of available buses.
2. Tap **Claim** next to the bus assigned to you for today.
3. Once claimed, the bus shows **Your bus** and your console opens.

> Only one driver can claim a bus at a time. If a bus shows **Taken**, it has already been claimed by another driver.

### 4.3 Broadcasting Your Location

1. Tap **Start live location**.
2. Allow location access when prompted.
3. Your GPS coordinates are sent to Firestore every few seconds.
4. The **LIVE** badge appears in green when sharing is active.
5. Students can see your bus moving on the **Tracking** map in real time.

> Keep the Driver console tab open while driving. GPS sharing continues even if you navigate to the map page, but closing the tab stops sharing.

### 4.4 Updating Bus Status

Use the **Status** dropdown to update the bus lifecycle:

| Status | When to set it |
|--------|---------------|
| **Idle** | Bus is parked, not yet accepting passengers |
| **Boarding** | Bus is at the stop — passengers should come now |
| **In transit** | Bus has departed and is on the road |
| **Arrived** | Bus has reached the destination |

> **Important:** When you set status to **Boarding**, all passengers with active tickets receive an automatic notification telling them to proceed to the bus.
>
> When you set status to **Arrived**, all boarded passengers are automatically marked as **Completed** and the seat counter resets to 0, making all seats available for the next trip.

### 4.5 Setting ETA

Enter the estimated arrival time in minutes in the **ETA (min)** field. This is shown to students on the booking page and their tickets.

### 4.6 Passenger Pickup Map

Below the controls, a map shows the GPS locations of all highway pickup passengers on your bus. Blue dots are passengers with saved locations. Use this to plan your stops along the highway.

### 4.7 Releasing the Bus

At the end of your shift, tap **Release bus**. This:
- Stops GPS sharing
- Removes your claim on the bus
- Sets the bus status back to **Idle**

---

## 5. Admin / Operator Guide

The Operations dashboard gives full control over the fleet, routes, fares, and staff.

### 5.1 Accessing the Dashboard

1. Sign in with your admin account.
2. Tap **Operations** in the navigation bar.

The dashboard shows four KPI cards at the top:
- **Coasters** — total number of buses
- **Active tickets** — total passengers currently booked
- **In queue** — passengers waiting for a seat
- **Total capacity** — combined seat capacity of all buses

### 5.2 Fleet & GCash Tab

The fleet table shows all buses with the following editable fields:

**Route** — dropdown to reassign the bus to any of the 6 routes. Change this when a bus needs to cover a return trip.

**Load** — progress bar showing how many seats are filled.

**ETA** — editable field. Enter minutes and press Tab/click away to save.

**Fare (₱)** — editable fare for the route. Click the save icon to update. This immediately changes the fare shown to students on the booking page.

**Status** — dropdown to manually override bus status (idle / boarding / in_transit / arrived).

**Driver / Conductor** — dropdowns to assign staff to the bus.

**GCash** — enter the GCash number for this bus and click **Save**. Students see this number when paying by GCash.

### 5.3 Routes Tab

Shows all 6 routes with their origin, destination, current fare, and assigned buses.

- Edit the fare directly in the table and click **Save** to update it.
- The **Buses assigned** column shows which buses are currently running that route.

**Available routes:**

| Route | Default Fare |
|-------|-------------|
| Mansalay → Roxas | ₱60 |
| Roxas → Mansalay | ₱60 |
| Roxas → Bulalacao | ₱80 |
| Bulalacao → Roxas | ₱80 |
| Mansalay → Bulalacao | ₱50 |
| Bulalacao → Mansalay | ₱50 |

### 5.4 Staff Management Tab

**Creating a staff account:**
1. Fill in the **Full name**, **Email**, and **Password** fields.
2. Select the **Role** — Driver or Conductor.
3. Click **Create account**.

The account is created in Firebase Authentication and the staff member can sign in immediately.

**Removing a staff role:**
1. Find the staff member in the Drivers or Conductors list.
2. Click **Remove**.
3. Their role is removed and they are unassigned from any bus. Their account still exists but they will have student-level access.

---

## 6. Notifications & Alerts

Tap **Alerts** in the navigation bar to see your notification inbox.

### Types of Notifications

| Notification | Who receives it | When |
|-------------|----------------|------|
| **Seat confirmed** | Student | Immediately after booking |
| **Added to queue** | Student | When bus is full at booking time |
| **Bus is now boarding** | All ticket holders on that bus | When driver sets status → Boarding |
| **Bus approaching your location** | Highway pickup students | When bus is within 1.5 km of saved pickup point |

### Reading Notifications

- Unread notifications show a **red badge** on the Alerts icon.
- Tap a notification to mark it as read.
- Tap **Mark all read** to clear all unread notifications at once.

---

## 7. Live Tracking Map

Tap **Tracking** in the navigation bar to see all buses on a live map.

- **Red bus icons** show the current GPS position of each bus.
- **Yellow dashed lines** show the route corridors.
- **Yellow circles** mark the three towns: Mansalay, Roxas, Bulalacao.
- The sidebar on the right lists all buses with their plate number, route, coordinates, and ETA.

### Proximity Alerts on the Map

The tracking page also checks your location against nearby buses. If a bus comes within **1.5 km** of your position while you have the tracking page open, a toast notification pops up immediately — even if you haven't saved a pickup location in your profile.

> For alerts when you are **not** on the tracking page, save your highway pickup location in your Profile.

---

## 8. Installing the App (PWA)

CoasterBusForU is a Progressive Web App — you can install it on your phone's home screen and use it like a native app (no app store required).

### Android (Chrome)

1. Open the app in Chrome.
2. Tap the **three-dot menu** (⋮) in the top right.
3. Tap **Add to Home screen**.
4. Tap **Add** to confirm.
5. The CoasterBusForU icon appears on your home screen.

### iOS (Safari)

1. Open the app in Safari.
2. Tap the **Share** button (the box with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add** in the top right.
5. The CoasterBusForU icon appears on your home screen.

### Benefits of Installing

- Opens full-screen without the browser address bar
- Faster loading after first visit (assets are cached)
- Works with reduced connectivity (cached pages load offline)
- Receives proximity alerts even when the app is in the background (on supported devices)

---

## 9. Frequently Asked Questions

**Q: I booked a seat but the bus was full. What happens?**
You are placed in the FIFO queue. Your ticket shows your queue position (e.g. #15). If a passenger cancels or is marked no-show, the seat counter decreases and you may be promoted. The conductor can board queued passengers if space becomes available.

**Q: My QR code won't scan. What do I do?**
Ask the conductor to enter your ticket code manually. Your 8-character code is shown on your ticket (e.g. `A1B2C3D4`).

**Q: I paid by GCash but my ticket still shows "Not yet paid".**
The conductor must verify your GCash payment. Show the conductor your GCash transaction receipt. They will tap **Verify payment** on your ticket row, which updates your status to Paid.

**Q: Can I book multiple buses at the same time?**
No. You can only have one active ticket per bus. You can book tickets on different buses (different routes) simultaneously.

**Q: How do I cancel my ticket?**
Go to **My Tickets** and tap **Cancel** on the ticket. Cancellation is only available for tickets with status **Confirmed** or **Queued**.

**Q: The bus status shows "Arrived" but I haven't boarded yet.**
The trip has ended. Wait for the driver to start a new trip (status will return to **Idle** then **Boarding**). Your ticket remains valid for the next departure.

**Q: I don't see any buses on the booking page.**
Make sure you have selected the correct **Origin** and **Destination** in the direction picker. If no buses appear for your route, check back later — buses may not be scheduled yet for that direction.

**Q: My location wasn't detected for highway pickup.**
Make sure you have allowed location access in your browser settings. On mobile, go to **Settings → Browser → Location** and allow access for the CoasterBusForU site.

**Q: I am a driver but I see the same bus as another driver.**
Each driver must claim their own bus. If a bus shows **Taken**, it has been claimed by another driver. Contact your administrator to reassign buses.

**Q: How do I get conductor or driver access?**
Staff accounts are created by the administrator from the Operations dashboard. Contact your school operator to request a staff account.

---

*CoasterBusForU · Romanbul Student Transport · 2026*
