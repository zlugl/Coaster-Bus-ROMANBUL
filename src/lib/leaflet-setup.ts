import type { Map as LMap, TileLayer } from "leaflet";

export const SERVICE_CENTER: [number, number] = [12.472, 121.43];

export type LeafletBundle = {
  map: LMap;
  L: typeof import("leaflet");
  tiles: TileLayer;
};

/** Create an OSM map on a container that already has explicit width & height. */
export async function createOsmMap(container: HTMLElement): Promise<LeafletBundle> {
  const L = await import("leaflet");
  // @ts-expect-error leaflet internal
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });

  const map = L.map(container, {
    center: SERVICE_CENTER,
    zoom: 11,
    preferCanvas: true,
  });

  const tiles = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    },
  );
  tiles.addTo(map);

  return { map, L, tiles };
}

/** Leaflet needs a layout pass after the container becomes visible / sized. */
export function refreshMapSize(map: LMap, delayMs = 0): void {
  const run = () => map.invalidateSize({ animate: false });
  if (delayMs > 0) {
    window.setTimeout(run, delayMs);
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
}
