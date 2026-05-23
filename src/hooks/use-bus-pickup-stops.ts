import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/integrations/firebase";
import { parseCoord } from "@/lib/geo";

export type PickupStop = {
  ticketId: string;
  userId: string;
  fullName: string;
  studentId: string;
  ticketCode: string;
  pickupType: "highway" | "terminal";
  seatNumber: number | null;
  queuePosition: number;
  status: string;
  lat: number | null;
  lng: number | null;
};

const ACTIVE_STATUSES = ["confirmed", "queued", "boarded"] as const;

function sortStops(a: PickupStop, b: PickupStop): number {
  const seatA = a.seatNumber ?? 999;
  const seatB = b.seatNumber ?? 999;
  if (seatA !== seatB) return seatA - seatB;
  return a.queuePosition - b.queuePosition;
}

export function useBusPickupStops(busId: string | null) {
  const [stops, setStops] = useState<PickupStop[]>([]);
  const [loading, setLoading] = useState(!!busId);

  useEffect(() => {
    if (!busId) {
      setStops([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "tickets"),
      where("busId", "==", busId),
      where("status", "in", [...ACTIVE_STATUSES]),
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const rows = await Promise.all(
          snap.docs.map(async (d) => {
            const t = d.data();
            const userSnap = await getDoc(doc(db, "users", t.userId as string));
            const u = userSnap.exists() ? userSnap.data() : {};
            const pickupType = (t.pickupType as "highway" | "terminal") ?? "terminal";
            const lat =
              pickupType === "highway" ? parseCoord(u.pickupLat) : null;
            const lng =
              pickupType === "highway" ? parseCoord(u.pickupLng) : null;

            return {
              ticketId: d.id,
              userId: t.userId as string,
              fullName: (u.fullName as string) ?? "",
              studentId: (u.studentId as string) ?? "",
              ticketCode: (t.ticketCode as string) ?? "",
              pickupType,
              seatNumber: (t.seatNumber as number | null) ?? null,
              queuePosition: (t.queuePosition as number) ?? 0,
              status: (t.status as string) ?? "",
              lat,
              lng,
            } satisfies PickupStop;
          }),
        );
        rows.sort(sortStops);
        setStops(rows);
        setLoading(false);
      },
      () => {
        setStops([]);
        setLoading(false);
      },
    );

    return unsub;
  }, [busId]);

  const highwayOnMap = useMemo(
    () =>
      stops.filter(
        (s) =>
          s.pickupType === "highway" &&
          s.lat != null &&
          s.lng != null,
      ),
    [stops],
  );

  const highwayMissingGps = useMemo(
    () =>
      stops.filter(
        (s) =>
          s.pickupType === "highway" &&
          (s.lat == null || s.lng == null),
      ),
    [stops],
  );

  const terminalStops = useMemo(
    () => stops.filter((s) => s.pickupType === "terminal"),
    [stops],
  );

  return {
    stops,
    highwayOnMap,
    highwayMissingGps,
    terminalStops,
    loading,
  };
}
