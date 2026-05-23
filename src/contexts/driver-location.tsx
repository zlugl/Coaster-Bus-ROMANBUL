/**
 * DriverLocationContext
 *
 * Automatically starts GPS sharing as soon as the driver claims a bus and
 * keeps it running continuously — no manual button press required.
 *
 * Throttling: Firestore is only written when the position changes by more
 * than MIN_DISTANCE_METERS OR more than MAX_WRITE_INTERVAL_MS has elapsed
 * since the last write. This prevents flooding Firestore on every GPS tick
 * while still keeping the map accurate.
 *
 * Proximity notifications: on each GPS fix, checks every active highway
 * pickup ticket holder's saved location. If within PROXIMITY_ALERT_KM,
 * writes a one-time Firestore notification for that student.
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { doc, updateDoc, collection, getDocs, query, where, writeBatch, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, firebaseAuth } from "@/integrations/firebase";
import { toast } from "sonner";

/** Minimum distance change (metres) before writing a new position to Firestore. */
const MIN_DISTANCE_METERS = 15;

/** Maximum interval (ms) between Firestore writes even if position hasn't changed. */
const MAX_WRITE_INTERVAL_MS = 10_000;

/** Distance in km at which a proximity alert is sent to the student. */
const PROXIMITY_ALERT_KM = 1.5;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

interface DriverLocationState {
  sharing: boolean;
  busId: string | null;
  lastFix: { lat: number; lng: number; at: Date; accuracy: number } | null;
  /** Call this when the driver claims a bus. GPS starts automatically. */
  startSharing: (busId: string, currentStatus: string) => void;
  stopSharing: () => void;
  /** Update the current bus status ref without restarting the watch. */
  updateStatus: (newStatus: string) => void;
}

const DriverLocationContext = createContext<DriverLocationState>({
  sharing: false,
  busId: null,
  lastFix: null,
  startSharing: () => {},
  stopSharing: () => {},
  updateStatus: () => {},
});

export function DriverLocationProvider({ children }: { children: React.ReactNode }) {
  const [sharing, setSharing] = useState(false);
  const [busId, setBusId] = useState<string | null>(null);
  const [lastFix, setLastFix] = useState<{ lat: number; lng: number; at: Date; accuracy: number } | null>(null);

  const watchId = useRef<number | null>(null);
  const busIdRef = useRef<string | null>(null);
  const currentStatusRef = useRef<string>("idle");
  const plateNumberRef = useRef<string>("");

  // Throttle tracking
  const lastWrittenPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastWriteTimeRef = useRef<number>(0);

  // Proximity alerts — track who has been alerted this trip
  const proximityAlertedRef = useRef<Set<string>>(new Set());

  const stopSharing = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setSharing(false);
    setBusId(null);
    lastWrittenPosRef.current = null;
    lastWriteTimeRef.current = 0;
    proximityAlertedRef.current.clear();
  }, []);

  const updateStatus = useCallback((newStatus: string) => {
    currentStatusRef.current = newStatus;
  }, []);

  const checkProximityAlerts = useCallback(async (
    busLat: number, busLng: number, currentBusId: string, plateNumber: string,
  ) => {
    try {
      const ticketSnap = await getDocs(
        query(
          collection(db, "tickets"),
          where("busId", "==", currentBusId),
          where("status", "in", ["confirmed", "queued"]),
          where("pickupType", "==", "highway"),
        ),
      );
      if (ticketSnap.empty) return;

      const batch = writeBatch(db);
      let alertCount = 0;

      for (const ticketDoc of ticketSnap.docs) {
        const userId = ticketDoc.data().userId as string;
        if (proximityAlertedRef.current.has(userId)) continue;

        const userSnap = await getDoc(doc(db, "users", userId));
        if (!userSnap.exists()) continue;

        const userData = userSnap.data();
        const pickupLat = userData.pickupLat as number | undefined;
        const pickupLng = userData.pickupLng as number | undefined;
        if (pickupLat == null || pickupLng == null) continue;

        const dist = haversineKm(busLat, busLng, pickupLat, pickupLng);
        if (dist > PROXIMITY_ALERT_KM) continue;

        proximityAlertedRef.current.add(userId);
        alertCount++;

        const distMeters = Math.round(dist * 1000);
        const notifRef = doc(collection(db, "notifications"));
        batch.set(notifRef, {
          userId,
          title: "Bus approaching your location",
          message: `${plateNumber} is ${distMeters} m away from your pickup point. Get ready to board!`,
          read: false,
          createdAt: new Date(),
        });
      }

      if (alertCount > 0) await batch.commit();
    } catch {
      // Best-effort — silently ignore
    }
  }, []);

  const startSharing = useCallback((newBusId: string, currentStatus: string) => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported on this device.");
      return;
    }

    // Stop any existing watch before starting a new one
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }

    busIdRef.current = newBusId;
    currentStatusRef.current = currentStatus;
    lastWrittenPosRef.current = null;
    lastWriteTimeRef.current = 0;
    proximityAlertedRef.current.clear();

    // Fetch plate number once for notification messages
    getDoc(doc(db, "buses", newBusId)).then((s) => {
      if (s.exists()) plateNumberRef.current = s.data().plateNumber ?? newBusId;
    });

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        const now = Date.now();

        setLastFix({ lat, lng, at: new Date(), accuracy });

        if (!busIdRef.current) return;

        // Throttle: only write if moved enough OR enough time has passed
        const lastPos = lastWrittenPosRef.current;
        const timeSinceLastWrite = now - lastWriteTimeRef.current;
        const movedEnough = !lastPos ||
          haversineMeters(lastPos.lat, lastPos.lng, lat, lng) >= MIN_DISTANCE_METERS;
        const timeExpired = timeSinceLastWrite >= MAX_WRITE_INTERVAL_MS;

        if (!movedEnough && !timeExpired) return;

        lastWrittenPosRef.current = { lat, lng };
        lastWriteTimeRef.current = now;

        try {
          await updateDoc(doc(db, "buses", busIdRef.current), {
            currentLat: lat,
            currentLng: lng,
            // Auto-transition from idle to in_transit when GPS starts moving
            status: currentStatusRef.current === "idle" ? "in_transit" : currentStatusRef.current,
            lastGpsFix: new Date().toISOString(),
          });
        } catch {
          // Silently ignore — bus may have been released
        }

        checkProximityAlerts(lat, lng, busIdRef.current, plateNumberRef.current);
      },
      (err) => {
        // On permission denied, show a clear message
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Location access denied. Please allow location in your browser settings.");
        } else {
          toast.error(`GPS error: ${err.message}`);
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,   // Accept cached position up to 3s old
        timeout: 20000,     // Wait up to 20s for a fix
      },
    );

    watchId.current = id;
    setSharing(true);
    setBusId(newBusId);
  }, [checkProximityAlerts]);

  // Clean up on unmount
  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  // Reset on auth change (sign-out or account switch)
  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, () => {
      stopSharing();
      setLastFix(null);
      busIdRef.current = null;
      currentStatusRef.current = "idle";
      plateNumberRef.current = "";
      proximityAlertedRef.current.clear();
    });
    return unsub;
  }, [stopSharing]);

  return (
    <DriverLocationContext.Provider value={{ sharing, busId, lastFix, startSharing, stopSharing, updateStatus }}>
      {children}
    </DriverLocationContext.Provider>
  );
}

export function useDriverLocation() {
  return useContext(DriverLocationContext);
}
