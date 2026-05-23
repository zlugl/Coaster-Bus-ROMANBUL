/** Rough minutes per queue spot ahead of you (tunable per operator) */
const MINUTES_PER_QUEUE_SPOT = 4;

export function estimateQueueWaitMinutes(
  queuePosition: number,
  busEtaMinutes: number,
  busStatus: string,
): number {
  if (queuePosition <= 0) return 0;
  const base = Math.max(0, busEtaMinutes ?? 0);
  const ahead = Math.max(0, queuePosition - 1);
  const queueComponent = ahead * MINUTES_PER_QUEUE_SPOT;
  const statusAdjust =
    busStatus === "boarding" ? 0 : busStatus === "in_transit" ? 6 : 3;
  return Math.max(1, Math.round(base + queueComponent + statusAdjust));
}

export function formatQueueWait(minutes: number): string {
  if (minutes < 1) return "Any moment now";
  if (minutes === 1) return "~1 minute";
  if (minutes < 60) return `~${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h} hour${h > 1 ? "s" : ""}`;
}

export type CrowdLevel = "light" | "moderate" | "busy" | "full";

export function crowdLevel(filled: number, capacity: number): CrowdLevel {
  if (capacity <= 0) return "light";
  if (filled >= capacity) return "full";
  const ratio = filled / capacity;
  if (ratio < 0.4) return "light";
  if (ratio < 0.75) return "moderate";
  return "busy";
}

export const CROWD_COPY: Record<
  CrowdLevel,
  { label: string; className: string }
> = {
  light: { label: "Light crowd", className: "bg-success/15 text-success" },
  moderate: { label: "Moderate", className: "bg-accent/15 text-accent-foreground" },
  busy: { label: "Getting busy", className: "bg-warning/15 text-warning-foreground" },
  full: { label: "At capacity", className: "bg-destructive/10 text-destructive" },
};

const STATUS_SORT: Record<string, number> = {
  boarding: 0,
  in_transit: 1,
  idle: 2,
  arrived: 3,
};

export function sortBusesForStudent<T extends { id: string; status: string }>(
  buses: T[],
  favoriteBusId: string | null,
): T[] {
  return [...buses].sort((a, b) => {
    if (favoriteBusId) {
      if (a.id === favoriteBusId) return -1;
      if (b.id === favoriteBusId) return 1;
    }
    return (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9);
  });
}

export const OFFLINE_TICKET_KEY = (uid: string) => `cbf-offline-ticket:${uid}`;

export type OfflineTicketCache = {
  ticketCode: string;
  routeName: string;
  busPlate: string;
  qrPayload: string;
  savedAt: number;
};

export function cacheOfflineTicket(uid: string, data: OfflineTicketCache) {
  try {
    localStorage.setItem(OFFLINE_TICKET_KEY(uid), JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function readOfflineTicket(uid: string): OfflineTicketCache | null {
  try {
    const raw = localStorage.getItem(OFFLINE_TICKET_KEY(uid));
    if (!raw) return null;
    return JSON.parse(raw) as OfflineTicketCache;
  } catch {
    return null;
  }
}
