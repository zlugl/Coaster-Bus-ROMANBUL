import { useEffect, useRef, useState } from "react";
import type { PickupStop } from "@/hooks/use-bus-pickup-stops";
import { formatDistanceKm, haversineKm } from "@/lib/geo";
import { createOsmMap, refreshMapSize } from "@/lib/leaflet-setup";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, CircleMarker as LCircleMarker, Polyline as LPolyline } from "leaflet";
import { Building2, MapPin, Navigation, AlertCircle } from "lucide-react";

type RouteLine = {
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
};

export function DriverPickupMap({
  busId,
  busPlate,
  routeName,
  busLat,
  busLng,
  routeLine,
  highwayOnMap,
  highwayMissingGps,
  terminalStops,
  loading,
}: {
  busId: string;
  busPlate: string;
  routeName: string;
  busLat: number | null;
  busLng: number | null;
  routeLine?: RouteLine;
  highwayOnMap: PickupStop[];
  highwayMissingGps: PickupStop[];
  terminalStops: PickupStop[];
  loading: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LMap | null>(null);
  const pickupMarkers = useRef<LCircleMarker[]>([]);
  const busMarker = useRef<LCircleMarker | null>(null);
  const routePoly = useRef<LPolyline | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Initialize map once the visible container is mounted (after loading finishes)
  useEffect(() => {
    if (loading) return;

    const container = mapRef.current;
    if (!container) return;

    let cancelled = false;

    const init = async () => {
      try {
        if (mapInstance.current) {
          mapInstance.current.remove();
          mapInstance.current = null;
        }

        const { map } = await createOsmMap(container);
        if (cancelled) {
          map.remove();
          return;
        }

        mapInstance.current = map;

        resizeObserver.current?.disconnect();
        resizeObserver.current = new ResizeObserver(() => {
          if (mapInstance.current) refreshMapSize(mapInstance.current);
        });
        resizeObserver.current.observe(container);

        refreshMapSize(map);
        window.setTimeout(() => {
          if (mapInstance.current) refreshMapSize(mapInstance.current);
        }, 250);
        window.setTimeout(() => {
          if (mapInstance.current) refreshMapSize(mapInstance.current);
        }, 600);

        setMapError(null);
        setMapReady(true);
      } catch (err) {
        setMapError(err instanceof Error ? err.message : "Map failed to load");
        setMapReady(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      setMapReady(false);
      resizeObserver.current?.disconnect();
      resizeObserver.current = null;
      pickupMarkers.current.forEach((m) => m.remove());
      pickupMarkers.current = [];
      busMarker.current?.remove();
      busMarker.current = null;
      routePoly.current?.remove();
      routePoly.current = null;
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [busId, loading]);

  // Draw route, bus, and passenger markers
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapInstance.current) return;

      routePoly.current?.remove();
      routePoly.current = null;
      if (
        routeLine?.originLat != null &&
        routeLine?.destLat != null &&
        routeLine.originLng != null &&
        routeLine.destLng != null
      ) {
        routePoly.current = L.polyline(
          [
            [routeLine.originLat, routeLine.originLng],
            [routeLine.destLat, routeLine.destLng],
          ],
          { color: "#fbbf24", weight: 4, opacity: 0.8, dashArray: "8 6" },
        ).addTo(map);
      }

      pickupMarkers.current.forEach((m) => m.remove());
      pickupMarkers.current = [];

      highwayOnMap.forEach((stop) => {
        if (stop.lat == null || stop.lng == null) return;
        const label = stop.seatNumber ? String(stop.seatNumber) : "Q";
        const marker = L.circleMarker([stop.lat, stop.lng], {
          radius: 16,
          fillColor: "#2563eb",
          fillOpacity: 1,
          color: "#ffffff",
          weight: 3,
          opacity: 1,
        })
          .addTo(map)
          .bindTooltip(label, {
            permanent: true,
            direction: "center",
            className: "pickup-seat-tooltip",
          })
          .bindPopup(
            `<strong>${stop.fullName || "Student"}</strong><br/>` +
              `Highway pickup<br/>` +
              `${stop.seatNumber ? `Seat #${stop.seatNumber}` : `Queue #${stop.queuePosition}`}<br/>` +
              `<code>${stop.ticketCode}</code>`,
          );
        marker.on("click", () => setFocusedId(stop.ticketId));
        pickupMarkers.current.push(marker);
      });

      if (busLat != null && busLng != null) {
        const busPos: [number, number] = [busLat, busLng];
        if (busMarker.current) {
          busMarker.current.setLatLng(busPos);
        } else {
          busMarker.current = L.circleMarker(busPos, {
            radius: 18,
            fillColor: "#dc2626",
            fillOpacity: 1,
            color: "#ffffff",
            weight: 3,
          })
            .addTo(map)
            .bindPopup(`<strong>${busPlate}</strong><br/>Your bus · ${routeName}`);
        }
      } else if (busMarker.current) {
        busMarker.current.remove();
        busMarker.current = null;
      }

      const boundsPoints: [number, number][] = [];
      if (busLat != null && busLng != null) boundsPoints.push([busLat, busLng]);
      highwayOnMap.forEach((s) => {
        if (s.lat != null && s.lng != null) boundsPoints.push([s.lat, s.lng]);
      });

      if (boundsPoints.length === 1) {
        map.setView(boundsPoints[0], 14);
      } else if (boundsPoints.length > 1) {
        map.fitBounds(L.latLngBounds(boundsPoints), {
          padding: [56, 56],
          maxZoom: 14,
        });
      }

      refreshMapSize(map);
      window.setTimeout(() => refreshMapSize(map), 300);
    });

    return () => {
      cancelled = true;
    };
  }, [mapReady, highwayOnMap, busLat, busLng, busPlate, routeName, routeLine]);

  const focusStop = (stop: PickupStop) => {
    setFocusedId(stop.ticketId);
    const map = mapInstance.current;
    if (map && stop.lat != null && stop.lng != null) {
      map.setView([stop.lat, stop.lng], 15, { animate: true });
      const idx = highwayOnMap.findIndex((s) => s.ticketId === stop.ticketId);
      pickupMarkers.current[idx]?.openPopup();
    }
  };

  const allListed = [...highwayOnMap, ...highwayMissingGps, ...terminalStops];

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold">Passenger pickups</h3>
        <p className="text-sm text-muted-foreground">
          Only students with an active ticket on <strong>{busPlate}</strong> (
          {routeName}). Blue dots = highway pickup · red = your bus.
        </p>
        {highwayOnMap.length > 0 && (
          <p className="mt-1 text-xs font-medium text-primary">
            {highwayOnMap.length} pickup{highwayOnMap.length !== 1 ? "s" : ""} on map
          </p>
        )}
      </div>

      {loading ? (
        <div className="h-[min(55vh,420px)] min-h-[300px] rounded-xl border border-border skeleton-shimmer" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative z-0 h-[min(55vh,420px)] min-h-[300px] w-full overflow-hidden rounded-xl border border-border bg-[#d4d4d8]">
            <div ref={mapRef} className="absolute inset-0 z-0 h-full w-full" />
            {mapError && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 p-4 text-center text-sm text-destructive">
                {mapError}
              </div>
            )}
            <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] flex flex-col gap-1 rounded-md bg-black/70 px-2 py-1.5 text-[10px] text-white shadow-lg">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-red-600" />
                Your bus
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-blue-600" />
                Highway pickup
              </span>
            </div>
            {!mapReady && !mapError && (
              <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
                Loading map…
              </div>
            )}
            {mapReady && highwayOnMap.length === 0 && (
              <div className="pointer-events-none absolute inset-x-4 top-4 z-[1000] rounded-lg bg-black/75 px-3 py-2 text-center text-xs text-white">
                No highway pickups with GPS — check list below
              </div>
            )}
          </div>

          <div className="max-h-[min(40vh,360px)] space-y-2 overflow-y-auto rounded-xl border border-border bg-card p-2">
            {allListed.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No active bookings on this bus yet.
              </p>
            )}
            {highwayOnMap.map((stop) => {
              const dist =
                busLat != null &&
                busLng != null &&
                stop.lat != null &&
                stop.lng != null
                  ? haversineKm(busLat, busLng, stop.lat, stop.lng)
                  : null;
              return (
                <PickupListItem
                  key={stop.ticketId}
                  stop={stop}
                  dist={dist}
                  focused={focusedId === stop.ticketId}
                  onFocus={() => focusStop(stop)}
                  onMap
                />
              );
            })}
            {highwayMissingGps.map((stop) => (
              <PickupListItem
                key={stop.ticketId}
                stop={stop}
                dist={null}
                focused={focusedId === stop.ticketId}
                onFocus={() => setFocusedId(stop.ticketId)}
                warning="No GPS saved — ask student to set pickup in Profile"
              />
            ))}
            {terminalStops.map((stop) => (
              <PickupListItem
                key={stop.ticketId}
                stop={stop}
                dist={null}
                focused={focusedId === stop.ticketId}
                onFocus={() => setFocusedId(stop.ticketId)}
                terminal
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PickupListItem({
  stop,
  dist,
  focused,
  onFocus,
  warning,
  terminal,
  onMap,
}: {
  stop: PickupStop;
  dist: number | null;
  focused: boolean;
  onFocus: () => void;
  warning?: string;
  terminal?: boolean;
  onMap?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onFocus}
      className={cn(
        "card-interactive w-full rounded-lg border p-3 text-left transition-colors",
        focused ? "border-primary bg-primary/5" : "border-transparent bg-muted/20 hover:bg-muted/40",
        onMap && "ring-1 ring-blue-500/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{stop.fullName || "Student"}</p>
          <p className="font-mono text-xs text-amber">{stop.ticketCode}</p>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-bold">
          {stop.seatNumber ? `#${stop.seatNumber}` : `Q${stop.queuePosition}`}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {terminal ? (
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Terminal boarding
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Navigation className="h-3 w-3" /> Highway
            {onMap && (
              <span className="rounded bg-blue-600/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                On map
              </span>
            )}
          </span>
        )}
        {dist != null && (
          <span className="flex items-center gap-1 font-medium text-foreground">
            <MapPin className="h-3 w-3" />
            {formatDistanceKm(dist)} from you
          </span>
        )}
      </div>
      {warning && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-warning">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {warning}
        </p>
      )}
    </button>
  );
}
