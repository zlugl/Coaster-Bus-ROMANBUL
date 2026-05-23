/**
 * DriverLocationContext
 *
 * Keeps the GPS watch alive for the entire app session — survives page
 * navigation. The driver starts sharing on /driver and can freely visit
 * /tracking without the watch being cleared.
 *
 * Proximity notifications: on each GPS fix, the context checks every active
 * ticket holder's saved pickupLat/pickupLng. If the bus is within
 * PROXIMITY_ALERT_KM and a notification hasn't been sent yet this trip, it
 * writes a Firestore notification so the student is alerted even if they
 * aren't on the tracking page.
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { doc, updateDoc, collection, getDocs, query, where, writeBatch, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db } from "@/integrations/firebase";
import { firebaseAuth } from "@/integrations/firebase";
import { toast } from "sonner";

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

interface DriverLocationState {
  sharing: boolean;
  busId: string | null;
  lastFix: { lat: number; lng: number; at: Date } | null;
  startSharing: (busId: string, currentStatus: string) => void;
  stopSharing: () => void;
}

const DriverLocationContext = createContext<DriverLocationState>({
  sharing: false,
  busId: null,
  lastFix: null,
  startSharing: () => {},
  stopSharing: () => {},
});

export function DriverLocationProvider({ children }: { children: React.ReactNode }) {
  const [sharing, setSharing] = useState(false);
  const [busId, setBusId] = useState<string | null>(null);
  const [lastFix, setLastFix] = useState<{ lat: number; lng: number; at: Date } | null>(null);
  const watchId = useRef<number | null>(null);
  // Keep refs so the watchPosition callback always has the latest values
  // without needing to re-register the watch.
  const busIdRef = useRef<string | null>(null);
  const currentStatusRef = useRef<string>("idle");
  // Track which userIds have already received a proximity alert this trip
  // so we don't spam them on every GPS tick.
  const proximityAlertedRef = useRef<Set<string>>(new Set());

  const stopSharing = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setSharing(false);
    setBusId(null);
    proximityAlertedRef.current.clear();
  }, []);

  /**
   * Check every active ticket holder's saved pickup location against the
   * current bus position. If within PROXIMITY_ALERT_KM and not yet alerted
   * this trip, write a Firestore notification for that student.
   */
  const checkProximityAlerts = useCallback(async (busLat: number, busLng: number, currentBusId: string, plateNumber: string) => {
    try {
      // Fetch active tickets for this bus that have highway pickup
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
        // Skip if already alerted this trip
        if (proximityAlertedRef.current.has(userId)) continue;

        // Read the student's saved pickup location from their user profile
        const userSnap = await getDoc(doc(db, "users", userId));
        if (!userSnap.exists()) continue;

        const userData = userSnap.data();
        const pickupLat = userData.pickupLat as number | undefined;
        const pickupLng = userData.pickupLng as number | undefined;
        if (pickupLat == null || pickupLng == null) continue;

        const dist = haversineKm(busLat, busLng, pickupLat, pickupLng);
        if (dist > PROXIMITY_ALERT_KM) continue;

        // Mark as alerted so we don't repeat this trip
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
      // Silently ignore — proximity alerts are best-effort
    }
  }, []);

  const startSharing = useCallback((newBusId: string, currentStatus: string) => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported on this device.");
      return;
    }
    // Stop any existing watch first
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
    }

    busIdRef.current = newBusId;
    currentStatusRef.current = currentStatus;
    proximityAlertedRef.current.clear();

    // We need the plate number for notification messages — fetch it once
    let plateNumber = newBusId;
    getDoc(doc(db, "buses", newBusId)).then((s) => {
      if (s.exists()) plateNumber = s.data().plateNumber ?? newBusId;
    });

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLastFix({ lat, lng, at: new Date() });
        if (!busIdRef.current) return;
        try {
          await updateDoc(doc(db, "buses", busIdRef.current), {
            currentLat: lat,
            currentLng: lng,
            status: currentStatusRef.current === "idle" ? "in_transit" : currentStatusRef.current,
          });
        } catch {
          // Silently ignore write errors (e.g. bus released mid-drive)
        }
        // Check proximity alerts on every GPS fix (throttled by the alerted set)
        if (busIdRef.current) {
          checkProximityAlerts(lat, lng, busIdRef.current, plateNumber);
        }
      },
      (err) => toast.error(`Location error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    watchId.current = id;
    setSharing(true);
    setBusId(newBusId);
    toast.success("Live location sharing started.");
  }, [checkProximityAlerts]);

  // Clean up on unmount (app close / refresh)
  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  // Reset all state when the signed-in user changes (sign-out or account switch).
  // This prevents a driver's GPS session from leaking into another driver's session.
  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (fbUser) => {
      // If the user signs out or a different user signs in, stop sharing immediately.
      stopSharing();
      setLastFix(null);
      busIdRef.current = null;
      currentStatusRef.current = "idle";
      proximityAlertedRef.current.clear();
    });
    return unsub;
  // stopSharing is stable (useCallback with no deps that change), safe to include
  }, [stopSharing]);

  return (
    <DriverLocationContext.Provider value={{ sharing, busId, lastFix, startSharing, stopSharing }}>
      {children}
    </DriverLocationContext.Provider>
  );
}

export function useDriverLocation() {
  return useContext(DriverLocationContext);
}
