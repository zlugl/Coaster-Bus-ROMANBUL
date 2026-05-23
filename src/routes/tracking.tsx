import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase";
import { PageShell } from "@/components/PageShell";
import { useAuth } from "@/hooks/use-auth";
import { Bus, Clock, Bell, Crosshair, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceKm } from "@/lib/ux";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, Marker as LMarker, Polyline as LPolyline, CircleMarker as LCircleMarker } from "leaflet";

export const Route = createFileRoute("/tracking")({
  component: TrackingPage,
  head: () => ({ meta: [{ title: "Live tracking · CoasterBusForU" }] }),
});

type BusLive = { id: string; plateNumber: string; status: string; etaMinutes: number; currentLat: number | null; currentLng: number | null; routeName: string; routeOrigin: string; routeDest: string; originLat?: number; originLng?: number; destLat?: number; destLng?: number };

const SERVICE_CENTER: [number, number] = [12.472, 121.43];
const TOWNS = [{ name: "Mansalay", pos: [12.518, 121.438] as [number, number] }, { name: "Roxas", pos: [12.5847, 121.5108] as [number, number] }, { name: "Bulalacao", pos: [12.3144, 121.3475] as [number, number] }];
const PROXIMITY_KM = 1.5;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function TrackingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [buses, setBuses] = useState<BusLive[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LMap | null>(null);
  const busMarkers = useRef<Map<string, LMarker>>(new Map());
  const routePolys = useRef<LPolyline[]>([]);
  const alerted = useRef<Set<string>>(new Set());
  const studentPos = useRef<{ lat: number; lng: number } | null>(null);
  const studentMarker = useRef<LCircleMarker | null>(null);
  const [pickupLocation, setPickupLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  /** Saved profile pickup takes priority; fall back to one-shot GPS for map display */
  const studentMapLocation = pickupLocation ?? liveLocation;

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  function parseCoord(value: unknown): number | null {
    if (value == null) return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function applyStudentCoords(lat: number, lng: number) {
    setPickupLocation({ lat, lng });
    studentPos.current = { lat, lng };
  }

  // Real-time pickup location from profile (updates when student saves in Profile)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const lat = parseCoord(data.pickupLat);
      const lng = parseCoord(data.pickupLng);
      if (lat != null && lng != null) {
        applyStudentCoords(lat, lng);
      } else {
        setPickupLocation(null);
      }
    });
    return unsub;
  }, [user]);

  // Show current GPS on map when no saved pickup (also powers proximity alerts)
  useEffect(() => {
    if (!user || pickupLocation) return;
    if (!("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        setLiveLocation({ lat, lng });
        studentPos.current = { lat, lng };
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, pickupLocation]);

  useEffect(() => {
    if (!user || !mapRef.current || mapInstance.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current || mapInstance.current) return;
      // @ts-expect-error leaflet internal
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({ iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png", iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png", shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png" });
      const map = L.map(mapRef.current!, { center: SERVICE_CENTER, zoom: 11 });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19 }).addTo(map);
      TOWNS.forEach((t) => L.circleMarker(t.pos, { radius: 8, fillColor: "#fbbf24", fillOpacity: 1, color: "#0a1628", weight: 2 }).addTo(map).bindTooltip(t.name, { permanent: true, direction: "top", className: "leaflet-town-label" }));
      mapInstance.current = map;
      setTimeout(() => {
        map.invalidateSize();
        setMapReady(true);
      }, 0);
    });
    return () => {
      cancelled = true;
      setMapReady(false);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      studentMarker.current = null;
      busMarkers.current.clear();
      routePolys.current = [];
    };
  }, [user]);

  // Subscribe to buses via Firestore
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "buses"), async (snap) => {
      const rows = await Promise.all(snap.docs.map(async (d) => {
        const b = { id: d.id, ...d.data() } as Record<string, unknown> & { id: string };
        let routeName = "", routeOrigin = "", routeDest = "", originLat: number | undefined, originLng: number | undefined, destLat: number | undefined, destLng: number | undefined;
        if (b.routeId) {
          const r = await getDoc(doc(db, "routes", b.routeId as string));
          if (r.exists()) { const rd = r.data(); routeName = rd.name; routeOrigin = rd.origin; routeDest = rd.destination; originLat = rd.originLat; originLng = rd.originLng; destLat = rd.destLat; destLng = rd.destLng; }
        }
        return { id: b.id, plateNumber: b.plateNumber as string, status: (b.status as string) ?? "idle", etaMinutes: (b.etaMinutes as number) ?? 0, currentLat: (b.currentLat as number | null) ?? null, currentLng: (b.currentLng as number | null) ?? null, routeName, routeOrigin, routeDest, originLat, originLng, destLat, destLng } satisfies BusLive;
      }));
      setBuses(rows);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    import("leaflet").then((L) => {
      routePolys.current.forEach((p) => p.remove()); routePolys.current = [];
      const seenRoutes = new Set<string>();
      buses.forEach((b) => {
        if (!b.originLat || !b.destLat) return;
        const key = `${b.originLat},${b.destLat}`;
        if (seenRoutes.has(key)) return; seenRoutes.add(key);
        routePolys.current.push(L.polyline([[b.originLat, b.originLng!], [b.destLat, b.destLng!]], { color: "#fbbf24", weight: 3, opacity: 0.7, dashArray: "6 4" }).addTo(map));
      });

      // Student pickup / live GPS — circleMarker is more reliable than divIcon
      const loc = studentMapLocation;
      if (loc) {
        const pos: [number, number] = [loc.lat, loc.lng];
        const label = pickupLocation
          ? "<strong>Your saved pickup</strong><br/><span style='font-size:11px'>Highway pick-up point</span>"
          : "<strong>Your location</strong><br/><span style='font-size:11px'>Live GPS — save in Profile to keep</span>";
        if (studentMarker.current) {
          studentMarker.current.setLatLng(pos);
        } else {
          studentMarker.current = L.circleMarker(pos, {
            radius: 12,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            color: "#ffffff",
            weight: 3,
            opacity: 1,
          })
            .addTo(map)
            .bindPopup(label)
            .bindTooltip(pickupLocation ? "Your pickup" : "You are here", {
              permanent: false,
              direction: "top",
            });
          studentMarker.current.setZIndexOffset(1000);
        }
      } else if (studentMarker.current) {
        studentMarker.current.remove();
        studentMarker.current = null;
      }

      const seenIds = new Set<string>();
      buses.forEach((b) => {
        if (b.currentLat == null || b.currentLng == null) return;
        seenIds.add(b.id);
        const pos: [number, number] = [Number(b.currentLat), Number(b.currentLng)];
        if (studentPos.current && !alerted.current.has(b.id)) {
          const dist = haversineKm(studentPos.current.lat, studentPos.current.lng, pos[0], pos[1]);
          if (dist <= PROXIMITY_KM) {
            alerted.current.add(b.id);
            toast(`🚌 ${b.plateNumber} is ${(dist * 1000).toFixed(0)} m away — get ready to board!`, { duration: 8000, icon: "🔔" });
            if (Notification.permission === "granted") new Notification("CoasterBusForU — Bus approaching", { body: `${b.plateNumber} is ${(dist * 1000).toFixed(0)} m away.` });
          }
        }
        if (studentPos.current && alerted.current.has(b.id)) { const dist = haversineKm(studentPos.current.lat, studentPos.current.lng, pos[0], pos[1]); if (dist > 3) alerted.current.delete(b.id); }
        const busIcon = L.divIcon({ html: `<div style="background:#dc2626;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,.4)">🚌</div>`, className: "", iconSize: [32, 32], iconAnchor: [16, 16] });
        const existing = busMarkers.current.get(b.id);
        if (existing) { existing.setLatLng(pos); } else { const m = L.marker(pos, { icon: busIcon }).addTo(map).bindPopup(`<strong>${b.plateNumber}</strong><br/>${b.routeName}<br/>ETA: ${b.etaMinutes} min`); busMarkers.current.set(b.id, m); }
      });
      busMarkers.current.forEach((m, id) => { if (!seenIds.has(id)) { m.remove(); busMarkers.current.delete(id); } });
    });
  }, [buses, pickupLocation, liveLocation, studentMapLocation, mapReady]);

  const centerOnPickup = () => {
    const map = mapInstance.current;
    const loc = studentMapLocation;
    if (!map || !loc) {
      toast.info(
        pickupLocation
          ? "Map is still loading…"
          : "Allow location access or save your pickup in Profile.",
      );
      return;
    }
    map.setView([loc.lat, loc.lng], 15, { animate: true });
  };

  const centerOnBuses = () => {
    const map = mapInstance.current;
    if (!map) return;
    import("leaflet").then((L) => {
      const withPos = buses.filter((b) => b.currentLat != null && b.currentLng != null);
      if (withPos.length === 0) {
        toast.info("No buses with live location yet.");
        return;
      }
      const bounds = L.latLngBounds(
        withPos.map((b) => [Number(b.currentLat), Number(b.currentLng)] as [number, number]),
      );
      if (studentMapLocation) bounds.extend([studentMapLocation.lat, studentMapLocation.lng]);
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
    });
  };

  const requestAlerts = () => {
    if (typeof Notification === "undefined") {
      toast.error("Notifications are not supported in this browser.");
      return;
    }
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") toast.success("You'll get alerts when a bus is nearby.");
      else if (perm === "denied") toast.error("Notifications blocked — enable them in browser settings.");
    });
  };

  return (
    <PageShell mainClassName="!px-0 sm:!px-6">
      <div className="px-4 sm:px-0 animate-fade-in-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Live tracking</h1>
            <p className="text-sm text-muted-foreground sm:text-base">Real-time buses and your pickup on the map</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={requestAlerts}>
            <Bell className="h-3.5 w-3.5" /> Enable proximity alerts
          </Button>
        </div>
        <div className="mt-6 flex flex-col gap-4 lg:grid lg:grid-cols-[1.4fr_1fr] lg:gap-6">
          <div className="relative order-1 overflow-hidden rounded-none border-y border-border bg-surface sm:rounded-2xl sm:border" style={{ minHeight: "min(70vh, 520px)" }}>
            <div ref={mapRef} className="absolute inset-0 h-full w-full min-h-[min(70vh,520px)] lg:min-h-[450px]" />
            <div className="absolute bottom-3 left-3 z-[400] flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" className="h-8 gap-1.5 bg-background/95 shadow" onClick={centerOnPickup}>
                <LocateFixed className="h-3.5 w-3.5" /> My pickup
              </Button>
              <Button type="button" size="sm" variant="secondary" className="h-8 gap-1.5 bg-background/95 shadow" onClick={centerOnBuses}>
                <Crosshair className="h-3.5 w-3.5" /> All buses
              </Button>
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 z-[400] rounded-md bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur">OpenStreetMap</div>
            <div className="pointer-events-none absolute top-3 right-3 z-[400] flex flex-col gap-2">
              <div className="rounded-md bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-red-500 border-2 border-white" /> Bus</div>
              {studentMapLocation && (
                <div className="rounded-md bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500 border-2 border-white" />
                  {pickupLocation ? "Your pickup" : "Your location (GPS)"}
                </div>
              )}
            </div>
          </div>
          <div className="order-2 space-y-3 px-4 sm:px-0">
            {!studentMapLocation && (
              <div className="rounded-xl border border-accent/30 bg-accent/10 p-4">
                <p className="font-semibold text-accent-foreground">Show your location on the map</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Allow browser location access, or save a highway pickup point in Profile for permanent alerts.
                </p>
              </div>
            )}
            {liveLocation && !pickupLocation && (
              <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
                Using live GPS. Save your pickup in Profile so it stays fixed for highway boarding.
              </div>
            )}
            {buses.length === 0 && <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No active buses yet.</div>}
            {buses.map((b) => {
              const distance = studentMapLocation && b.currentLat != null && b.currentLng != null
                ? haversineKm(studentMapLocation.lat, studentMapLocation.lng, Number(b.currentLat), Number(b.currentLng))
                : null;
              return (
                <div key={b.id} className="group card-interactive rounded-xl border border-border bg-card p-4 animate-fade-in-up">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bus className="h-5 w-5 text-amber" />
                      <span className="font-mono text-base font-semibold">{b.plateNumber}</span>
                    </div>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{b.status.replace("_", " ")}</span>
                  </div>
                  <div className="mt-3 text-base font-medium">{b.routeName}</div>
                  <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {distance !== null ? (
                      <div className="font-medium text-foreground">{formatDistanceKm(distance)}</div>
                    ) : b.currentLat != null ? (
                      <div>Live on map</div>
                    ) : (
                      <div>Waiting for driver GPS…</div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <div className="flex items-center gap-1.5 text-sm"><Clock className="h-4 w-4 text-muted-foreground" /> ETA <strong>{b.etaMinutes} min</strong></div>
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-success" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-4 px-4 text-xs text-muted-foreground sm:px-0">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a> contributors. You will be notified when a bus is within {PROXIMITY_KM} km of your location.</p>
      </div>
    </PageShell>
  );
}
