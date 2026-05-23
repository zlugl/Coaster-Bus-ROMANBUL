/**
 * Firestore seed script for CoasterBusForU
 *
 * Seeds:
 *   - 6 routes (all 3 corridors × 2 directions each)
 *       Mansalay ↔ Roxas, Roxas ↔ Bulalacao, Mansalay ↔ Bulalacao
 *   - 6 buses  (CBF-001 through CBF-006)
 *   - 6 busGcash placeholders
 *   - 3 staff accounts in Firebase Auth + Firestore users collection:
 *       admin@coasterbus.app     / Admin@2026
 *       driver@coasterbus.app    / Driver@2026
 *       conductor@coasterbus.app / Conductor@2026
 *
 * Usage:
 *   1. Place your service account key at: scripts/serviceAccountKey.json
 *      (Firebase Console → Project Settings → Service Accounts → Generate new private key)
 *   2. node scripts/seed-firestore.mjs
 *
 * Idempotent — safe to run multiple times.
 */

import { readFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);
const admin     = require("firebase-admin");

// ── Service account ───────────────────────────────────────────────────────────
const keyPath = join(__dirname, "serviceAccountKey.json");
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
} catch {
  console.error("\n❌  Service account key not found.");
  console.error("   Download it from Firebase Console → Project Settings → Service Accounts");
  console.error(`   Save it to: ${keyPath}\n`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db   = admin.firestore();
const auth = admin.auth();

// ── Staff accounts ────────────────────────────────────────────────────────────
const STAFF = [
  {
    email:     "admin@coasterbus.app",
    password:  "Admin@2026",
    fullName:  "System Admin",
    studentId: "",
    roles:     ["admin"],
    label:     "Admin",
  },
  {
    email:     "driver@coasterbus.app",
    password:  "Driver@2026",
    fullName:  "Default Driver",
    studentId: "",
    roles:     ["driver"],
    label:     "Driver",
  },
  {
    email:     "conductor@coasterbus.app",
    password:  "Conductor@2026",
    fullName:  "Default Conductor",
    studentId: "",
    roles:     ["conductor"],
    label:     "Conductor",
  },
];

// ── Routes ────────────────────────────────────────────────────────────────────
const ROUTES = [
  // ── Forward routes ──
  {
    id:          "route-mansalay-roxas",
    name:        "Mansalay → Roxas",
    origin:      "Mansalay, Oriental Mindoro",
    destination: "Roxas, Oriental Mindoro",
    fare:        60,
    originLat:   12.518,
    originLng:   121.438,
    destLat:     12.5847,
    destLng:     121.5108,
  },
  {
    id:          "route-roxas-bulalacao",
    name:        "Roxas → Bulalacao",
    origin:      "Roxas, Oriental Mindoro",
    destination: "Bulalacao, Oriental Mindoro",
    fare:        80,
    originLat:   12.5847,
    originLng:   121.5108,
    destLat:     12.3144,
    destLng:     121.3475,
  },
  {
    id:          "route-mansalay-bulalacao",
    name:        "Mansalay → Bulalacao",
    origin:      "Mansalay, Oriental Mindoro",
    destination: "Bulalacao, Oriental Mindoro",
    fare:        50,
    originLat:   12.518,
    originLng:   121.438,
    destLat:     12.3144,
    destLng:     121.3475,
  },
  // ── Reverse routes ──
  {
    id:          "route-roxas-mansalay",
    name:        "Roxas → Mansalay",
    origin:      "Roxas, Oriental Mindoro",
    destination: "Mansalay, Oriental Mindoro",
    fare:        60,
    originLat:   12.5847,
    originLng:   121.5108,
    destLat:     12.518,
    destLng:     121.438,
  },
  {
    id:          "route-bulalacao-roxas",
    name:        "Bulalacao → Roxas",
    origin:      "Bulalacao, Oriental Mindoro",
    destination: "Roxas, Oriental Mindoro",
    fare:        80,
    originLat:   12.3144,
    originLng:   121.3475,
    destLat:     12.5847,
    destLng:     121.5108,
  },
  {
    id:          "route-bulalacao-mansalay",
    name:        "Bulalacao → Mansalay",
    origin:      "Bulalacao, Oriental Mindoro",
    destination: "Mansalay, Oriental Mindoro",
    fare:        50,
    originLat:   12.3144,
    originLng:   121.3475,
    destLat:     12.518,
    destLng:     121.438,
  },
];

// ── Buses ─────────────────────────────────────────────────────────────────────
const BUSES = [
  // ── Forward direction buses ──
  {
    id:                 "bus-cbf-001",
    plateNumber:        "CBF-001",
    routeId:            "route-mansalay-roxas",
    capacity:           14,
    status:             "idle",
    etaMinutes:         0,
    currentLat:         12.55,
    currentLng:         121.474,
    driverId:           null,
    conductorId:        null,
    activeTicketCount:  0,
    departureTime:      null,
  },
  {
    id:                 "bus-cbf-002",
    plateNumber:        "CBF-002",
    routeId:            "route-roxas-bulalacao",
    capacity:           14,
    status:             "idle",
    etaMinutes:         0,
    currentLat:         12.5847,
    currentLng:         121.5108,
    driverId:           null,
    conductorId:        null,
    activeTicketCount:  0,
    departureTime:      null,
  },
  {
    id:                 "bus-cbf-003",
    plateNumber:        "CBF-003",
    routeId:            "route-mansalay-bulalacao",
    capacity:           14,
    status:             "idle",
    etaMinutes:         0,
    currentLat:         12.41,
    currentLng:         121.39,
    driverId:           null,
    conductorId:        null,
    activeTicketCount:  0,
    departureTime:      null,
  },
  // ── Reverse direction buses ──
  {
    id:                 "bus-cbf-004",
    plateNumber:        "CBF-004",
    routeId:            "route-roxas-mansalay",
    capacity:           14,
    status:             "idle",
    etaMinutes:         0,
    currentLat:         12.5847,
    currentLng:         121.5108,
    driverId:           null,
    conductorId:        null,
    activeTicketCount:  0,
    departureTime:      null,
  },
  {
    id:                 "bus-cbf-005",
    plateNumber:        "CBF-005",
    routeId:            "route-bulalacao-roxas",
    capacity:           14,
    status:             "idle",
    etaMinutes:         0,
    currentLat:         12.3144,
    currentLng:         121.3475,
    driverId:           null,
    conductorId:        null,
    activeTicketCount:  0,
    departureTime:      null,
  },
  {
    id:                 "bus-cbf-006",
    plateNumber:        "CBF-006",
    routeId:            "route-bulalacao-mansalay",
    capacity:           14,
    status:             "idle",
    etaMinutes:         0,
    currentLat:         12.3144,
    currentLng:         121.3475,
    driverId:           null,
    conductorId:        null,
    activeTicketCount:  0,
    departureTime:      null,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create or update a Firebase Auth user, then write their Firestore profile.
 * If the email already exists we reuse the existing UID.
 */
async function upsertStaffUser(staff) {
  let uid;

  try {
    // Try to create — will throw if email already exists
    const created = await auth.createUser({
      email:         staff.email,
      password:      staff.password,
      displayName:   staff.fullName,
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`   ✓  Created  ${staff.label}  <${staff.email}>  uid: ${uid}`);
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      // Already exists — fetch the UID and update the password
      const existing = await auth.getUserByEmail(staff.email);
      uid = existing.uid;
      await auth.updateUser(uid, { password: staff.password, displayName: staff.fullName });
      console.log(`   ↻  Updated  ${staff.label}  <${staff.email}>  uid: ${uid}`);
    } else {
      throw err;
    }
  }

  // Write / overwrite the Firestore users document
  await db.collection("users").doc(uid).set(
    {
      email:     staff.email,
      fullName:  staff.fullName,
      studentId: staff.studentId,
      phone:     "",
      roles:     staff.roles,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return uid;
}

// ── Main seed ─────────────────────────────────────────────────────────────────
async function seed() {
  console.log("\n🌱  Seeding Firestore for CoasterBusForU...\n");

  // ── Staff accounts ──
  console.log("👤  Creating staff accounts in Firebase Auth + Firestore...");
  for (const staff of STAFF) {
    await upsertStaffUser(staff);
  }

  // ── Routes ──
  console.log("\n📍  Writing routes...");
  for (const route of ROUTES) {
    const { id, ...data } = route;
    await db.collection("routes").doc(id).set(data);
    console.log(`   ✓  ${data.name}  (₱${data.fare})`);
  }

  // ── Buses ──
  console.log("\n🚌  Writing buses...");
  for (const bus of BUSES) {
    const { id, ...data } = bus;
    await db.collection("buses").doc(id).set(data);
    console.log(`   ✓  ${data.plateNumber}  →  ${data.routeId}`);
  }

  // ── busGcash placeholders ──
  console.log("\n💳  Writing busGcash placeholders...");
  for (const bus of BUSES) {
    await db.collection("busGcash").doc(bus.id).set(
      { gcashNumber: "", updatedAt: new Date().toISOString() },
      { merge: true },
    );
    console.log(`   ✓  ${bus.plateNumber}`);
  }

  // ── Summary ──
  console.log("\n✅  Seed complete!\n");
  console.log("┌─────────────────────────────────────────────────────┐");
  console.log("│  Staff login credentials                            │");
  console.log("├──────────────────────────────────┬──────────────────┤");
  console.log("│  Email                           │  Password        │");
  console.log("├──────────────────────────────────┼──────────────────┤");
  for (const s of STAFF) {
    const emailPad = s.email.padEnd(32);
    const passPad  = s.password.padEnd(16);
    console.log(`│  ${emailPad}  │  ${passPad}  │`);
  }
  console.log("└──────────────────────────────────┴──────────────────┘");
  console.log("\n⚠️   Change these passwords after first sign-in!\n");
  console.log("Collections written:");
  console.log("  • users        (3 staff documents)");
  console.log("  • routes       (6 documents — all 3 corridors × 2 directions)");
  console.log("  • buses        (6 documents — CBF-001 through CBF-006)");
  console.log("  • busGcash     (6 documents)\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("\n❌  Seed failed:", err.message);
  if (err.message.includes("NOT_FOUND") || err.code === 5) {
    console.error("\n👉  Firestore database not created yet.");
    console.error("   Go to: https://console.firebase.google.com/project/coasterbus-d99b9/firestore");
    console.error("   Click 'Create database' → region 'asia-southeast1' → Production mode\n");
  }
  if (err.code === "auth/configuration-not-found") {
    console.error("\n👉  Firebase Authentication is not enabled.");
    console.error("   Go to: https://console.firebase.google.com/project/coasterbus-d99b9/authentication");
    console.error("   Click 'Get started' then enable Email/Password sign-in.\n");
  }
  process.exit(1);
});
