import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, getDoc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/integrations/firebase";
import { PageShell } from "@/components/PageShell";
import { useAuth } from "@/hooks/use-auth";
import { useDriverLocation } from "@/contexts/driver-location";
import { useBusPickupStops } from "@/hooks/use-bus-pickup-stops";
import { DriverPickupMap } from "@/components/driver/DriverPickupMap";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bus, MapPin, Radio, Square, Shield } from "lucide-react";

export const Route = createFileRoute("/driver")({
  component: DriverPage,
  head: () => ({ meta: [{ title: "Driver console · CoasterBusForU" }] }),
});

type BusRow = {
  id: string; plateNumber: string; capacity: number;
  status: string; etaMinutes: number; driverId: string | null;
  currentLat: number | null; currentLng: number | null;
  routeName?: string; routeOrigin?: string; routeDest?: string;
  originLat?: number; originLng?: number; destLat?: number; destLng?: number;
};

function DriverPage() {
  const { user, loading, isDriver, roles } = useAuth();
  const navigate = useNavigate();
  const { sharing, lastFix, startSharing, stopSharing } = useDriverLocation();
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!isDriver) return;
    const unsub = onSnapshot(collection(db, "buses"), async (snap) => {
      const rows = await Promise.all(snap.docs.map(async (d) => {
        const b = { id: d.id, ...d.data() } as Record<string, unknown> & { id: string };
        let routeName = "", routeOrigin = "", routeDest = "";
        let originLat: number | undefined, originLng: number | undefined;
        let destLat: number | undefined, destLng: number | undefined;
        if (b.routeId) {
          const rSnap = await getDoc(doc(db, "routes", b.routeId as string));
          if (rSnap.exists()) {
            const r = rSnap.data();
            routeName = r.name; routeOrigin = r.origin; routeDest = r.destination;
            originLat = r.originLat; originLng = r.originLng;
            destLat = r.destLat; destLng = r.destLng;
          }
        }
        return {
          id: b.id,
          plateNumber: b.plateNumber as string,
          capacity: (b.capacity as number) ?? 14,
          status: (b.status as string) ?? "idle",
          etaMinutes: (b.etaMinutes as number) ?? 0,
          driverId: (b.driverId as string | null) ?? null,
          currentLat: (b.currentLat as number | null) ?? null,
          currentLng: (b.currentLng as number | null) ?? null,
          routeName, routeOrigin, routeDest,
          originLat, originLng, destLat, destLng,
        } satisfies BusRow;
      }));
      setBuses(rows);
    });
    return unsub;
  }, [isDriver]);

  const myBus = buses.find((b) => b.driverId === user?.uid) ?? null;

  const {
    highwayOnMap,
    highwayMissingGps,
    terminalStops,
    loading: pickupsLoading,
  } = useBusPickupStops(myBus?.id ?? null);

  const driverLat = lastFix?.lat ?? myBus?.currentLat ?? null;
  const driverLng = lastFix?.lng ?? myBus?.currentLng ?? null;

  const grantDriver = async () => {
    if (!user) return;
    setGranting(true);
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const existing: string[] = snap.data()?.roles ?? ["student"];
    if (!existing.includes("driver")) await updateDoc(ref, { roles: [...existing, "driver"] });
    setGranting(false);
    toast.success("Driver access granted. Reloading...");
    setTimeout(() => location.reload(), 600);
  };

  const claim = async (busId: string) => {
    if (!user) return;
    const snap = await getDoc(doc(db, "buses", busId));
    if (snap.data()?.driverId) { toast.error("Bus already claimed."); return; }
    await updateDoc(doc(db, "buses", busId), { driverId: user.uid });
    toast.success("Bus claimed. Start sharing your location.");
  };

  const release = async (busId: string) => {
    stopSharing();
    await updateDoc(doc(db, "buses", busId), { driverId: null, status: "idle" });
    toast.success("Bus released.");
  };

  /**
   * Set the bus status and handle side-effects:
   * - When status becomes "boarding": write a Firestore notification to every
   *   student with an active ticket on this bus so they know to get ready.
   * - When status becomes "arrived": batch-complete all boarded tickets and
   *   reset activeTicketCount to 0 so seats open up for the next trip.
   * - All other transitions: just update the bus document.
   */
  const setBusStatus = async (busId: string, newStatus: string) => {
    if (newStatus === "boarding") {
      try {
        const busSnap = await getDoc(doc(db, "buses", busId));
        const plateNumber = busSnap.data()?.plateNumber ?? busId;
        // Fetch all active tickets for this bus
        const ticketSnap = await getDocs(
          query(collection(db, "tickets"), where("busId", "==", busId),
            where("status", "in", ["confirmed", "queued"])),
        );
        const batch = writeBatch(db);
        // Update bus status
        batch.update(doc(db, "buses", busId), { status: "boarding" });
        // Write a notification for each passenger
        ticketSnap.docs.forEach((d) => {
          const userId = d.data().userId as string;
          const seatNumber = d.data().seatNumber as number | null;
          const notifRef = doc(collection(db, "notifications"));
          batch.set(notifRef, {
            userId,
            title: "Bus is now boarding",
            message: seatNumber
              ? `${plateNumber} is now boarding. Your seat is #${seatNumber}. Please proceed to board.`
              : `${plateNumber} is now boarding. You are in the queue — proceed to the bus.`,
            read: false,
            createdAt: new Date(),
          });
        });
        await batch.commit();
        toast.success(`Boarding started. ${ticketSnap.size} passenger(s) notified.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update status.");
      }
    } else if (newStatus === "arrived") {
      try {
        // Fetch all boarded tickets for this bus
        const ticketSnap = await getDocs(
          query(collection(db, "tickets"), where("busId", "==", busId), where("status", "==", "boarded")),
        );
        const batch = writeBatch(db);
        // Complete every boarded ticket
        ticketSnap.docs.forEach((d) => {
          batch.update(d.ref, { status: "completed" });
        });
        // Reset the bus: mark arrived and clear the seat counter
        batch.update(doc(db, "buses", busId), {
          status: "arrived",
          activeTicketCount: 0,
          etaMinutes: 0,
        });
        await batch.commit();
        toast.success(`Arrived at destination. ${ticketSnap.size} passenger(s) marked as completed.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update status.");
      }
    } else {
      await updateDoc(doc(db, "buses", busId), { status: newStatus });
    }
  };

  if (loading) return <PageShell><div className="h-32 skeleton-shimmer rounded-xl" /></PageShell>;

  if (!isDriver) {
    return (
      <PageShell mainClassName="max-w-xl text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-bold">Driver access required</h1>
          <p className="mt-2 text-muted-foreground">
            Signed in as <strong>{user?.email}</strong>. Roles: {roles.join(", ") || "student"}.
          </p>
          {import.meta.env.DEV && (
            <Button className="mt-6" onClick={grantDriver} disabled={granting}>
              {granting ? "..." : "Request driver access (demo)"}
            </Button>
          )}
      </PageShell>
    );
  }

  return (
    <PageShell mainClassName="max-w-5xl">
        <div className="animate-fade-in-up">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Driver console</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Claim your bus, share GPS, and see highway pickups for your passengers.
        </p>

        {/* Live sharing persists across navigation — show banner if active */}
        {sharing && !myBus && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            GPS sharing is active. Your location is being broadcast.
          </div>
        )}

        {myBus ? (
          <section className="mt-6 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <Bus className="h-4 w-4" /> Your bus
                </div>
                <h2 className="mt-1 font-mono text-2xl font-bold">{myBus.plateNumber}</h2>
                <p className="text-sm text-muted-foreground">
                  {myBus.routeName} · {myBus.routeOrigin} → {myBus.routeDest}
                </p>
              </div>
              <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold
                ${sharing ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-foreground/70"}`}>
                <span className={`h-2 w-2 rounded-full ${sharing ? "animate-pulse bg-emerald-400" : "bg-muted-foreground"}`} />
                {sharing ? "LIVE" : "OFFLINE"}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {/* Last GPS fix */}
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Last fix</div>
                {lastFix ? (
                  <>
                    <div className="mt-1 font-mono text-sm">
                      {lastFix.lat.toFixed(5)}, {lastFix.lng.toFixed(5)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {lastFix.at.toLocaleTimeString()}
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-sm text-muted-foreground">No fix yet</div>
                )}
              </div>

              {/* Status */}
              <div className="rounded-xl border border-border bg-background p-4">
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Status</label>
                <select
                  value={myBus.status}
                  onChange={(e) => setBusStatus(myBus.id, e.target.value)}
                  className="mt-1 w-full rounded border border-input bg-background px-2 py-2"
                >
                  <option value="idle">idle</option>
                  <option value="boarding">boarding</option>
                  <option value="in_transit">in_transit</option>
                  <option value="arrived">arrived</option>
                </select>
              </div>

              {/* ETA */}
              <div className="rounded-xl border border-border bg-background p-4">
                <label className="text-xs uppercase tracking-widest text-muted-foreground">ETA (min)</label>
                <input
                  type="number"
                  defaultValue={myBus.etaMinutes}
                  onBlur={(e) => updateDoc(doc(db, "buses", myBus.id), { etaMinutes: parseInt(e.target.value) || 0 })}
                  className="mt-1 w-full rounded border border-input bg-background px-2 py-2"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {!sharing ? (
                <Button
                  onClick={() => startSharing(myBus.id, myBus.status)}
                  className="gap-2"
                >
                  <Radio className="h-4 w-4" /> Start live location
                </Button>
              ) : (
                <Button onClick={stopSharing} variant="secondary" className="gap-2">
                  <Square className="h-4 w-4" /> Stop sharing
                </Button>
              )}
              <Button onClick={() => release(myBus.id)} variant="ghost">
                Release bus
              </Button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              GPS sharing continues even if you navigate away — keep this tab open while driving.
            </p>

            <DriverPickupMap
              busId={myBus.id}
              busPlate={myBus.plateNumber}
              routeName={myBus.routeName ?? "Route"}
              busLat={driverLat}
              busLng={driverLng}
              routeLine={{
                originLat: myBus.originLat,
                originLng: myBus.originLng,
                destLat: myBus.destLat,
                destLng: myBus.destLng,
              }}
              highwayOnMap={highwayOnMap}
              highwayMissingGps={highwayMissingGps}
              terminalStops={terminalStops}
              loading={pickupsLoading}
            />
          </section>
        ) : (
          <section className="mt-6">
            <h2 className="font-display text-xl font-bold">Available coasters</h2>
            <p className="text-sm text-muted-foreground">Claim the bus assigned to you today.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {buses.map((b) => {
                const taken = b.driverId && b.driverId !== user?.uid;
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
                  >
                    <div>
                      <div className="font-mono text-lg font-bold">{b.plateNumber}</div>
                      <div className="text-xs text-muted-foreground">{b.routeName}</div>
                      {taken && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-amber">
                          <MapPin className="h-3 w-3" /> Driver assigned
                        </div>
                      )}
                    </div>
                    <Button size="sm" disabled={!!taken} onClick={() => claim(b.id)}>
                      {taken ? "Taken" : "Claim"}
                    </Button>
                  </div>
                );
              })}
              {buses.length === 0 && (
                <p className="text-sm text-muted-foreground">No buses yet.</p>
              )}
            </div>
          </section>
        )}
        </div>
    </PageShell>
  );
}
