/** Human-readable ticket status labels and styles */
export const TICKET_STATUS: Record<
  string,
  { label: string; className: string }
> = {
  confirmed: {
    label: "Seat confirmed",
    className: "bg-success/20 text-success",
  },
  queued: {
    label: "Waiting in queue",
    className: "bg-warning/20 text-warning-foreground",
  },
  boarded: {
    label: "On board",
    className: "bg-accent/20 text-accent-foreground",
  },
  completed: {
    label: "Trip completed",
    className: "bg-muted text-muted-foreground",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/20 text-destructive",
  },
};

export function ticketStatusLabel(status: string): string {
  return TICKET_STATUS[status]?.label ?? status.replace(/_/g, " ");
}

export function ticketStatusClass(status: string): string {
  return (
    TICKET_STATUS[status]?.className ?? "bg-muted text-muted-foreground"
  );
}

/** Map Firebase Auth error codes to student-friendly copy */
export function formatFirebaseAuthError(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  const messages: Record<string, string> = {
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-disabled": "This account has been disabled. Contact support.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
  };
  if (code && messages[code]) return messages[code];
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

export function formatDistanceKm(km: number): string {
  if (km < 0.001) return "At your location";
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Bus operational status — student-facing labels and guidance */
export type BusOperationalStatus =
  | "idle"
  | "boarding"
  | "in_transit"
  | "arrived";

export const BUS_STATUS: Record<
  BusOperationalStatus,
  {
    label: string;
    description: string;
    studentTip: string;
    className: string;
    dotClass: string;
  }
> = {
  idle: {
    label: "Waiting to depart",
    description:
      "The coaster is parked and has not left yet. Seats are open for booking.",
    studentTip: "Best time to book — you’ll get a seat number or a fair queue spot.",
    className: "bg-muted/80 text-muted-foreground border-border",
    dotClass: "bg-muted-foreground",
  },
  boarding: {
    label: "Now boarding",
    description:
      "The bus is at the stop and passengers with tickets may board now.",
    studentTip: "Have your QR ready. If you’re queued, watch your position — it updates live.",
    className: "bg-success/15 text-success border-success/30",
    dotClass: "bg-success animate-pulse",
  },
  in_transit: {
    label: "On the way",
    description:
      "The coaster is moving along the route. You can still book for the next round or join the queue.",
    studentTip: "Use Live Tracking to see how far the bus is from your pickup.",
    className: "bg-accent/15 text-accent-foreground border-accent/30",
    dotClass: "bg-amber",
  },
  arrived: {
    label: "Trip finished",
    description:
      "This run has ended at the destination. Wait for the operator to start the next trip.",
    studentTip: "Check back soon — the same bus may open for boarding again.",
    className: "bg-primary/10 text-primary border-primary/20",
    dotClass: "bg-primary",
  },
};

export const BUS_STATUS_LEGEND_ORDER: BusOperationalStatus[] = [
  "boarding",
  "idle",
  "in_transit",
  "arrived",
];

export function busStatusInfo(status: string) {
  const key = status as BusOperationalStatus;
  if (BUS_STATUS[key]) return { key, ...BUS_STATUS[key] };
  return {
    key: "idle" as BusOperationalStatus,
    label: status.replace(/_/g, " "),
    description: "",
    studentTip: "",
    className: "bg-muted text-muted-foreground border-border",
    dotClass: "bg-muted-foreground",
  };
}

export type AvailabilityLevel = "open" | "filling" | "full" | "queue";

export function busAvailabilityLevel(
  filled: number,
  capacity: number,
): AvailabilityLevel {
  if (filled >= capacity) return "queue";
  const ratio = filled / capacity;
  if (ratio >= 0.85) return "full";
  if (ratio >= 0.5) return "filling";
  return "open";
}

export const AVAILABILITY_COPY: Record<
  AvailabilityLevel,
  { label: string; className: string }
> = {
  open: { label: "Seats available", className: "bg-success/15 text-success" },
  filling: { label: "Filling up", className: "bg-warning/15 text-warning-foreground" },
  full: { label: "Almost full", className: "bg-warning/20 text-warning-foreground" },
  queue: { label: "Queue only", className: "bg-destructive/10 text-destructive" },
};
