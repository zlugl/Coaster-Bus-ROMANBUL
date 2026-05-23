import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
// List of all possible stops for direction picker
const STOPS = ["Roxas", "Mansalay", "Bulalacao"];

import {
  collection, onSnapshot,
  doc, getDoc,
} from "firebase/firestore";
import { db } from "@/integrations/firebase";
import { useAuth } from "@/hooks/use-auth";
import { bookTicket } from "@/lib/tickets.functions";
import { Button } from "@/components/ui/button";
import {
  Bus, MapPin, Clock, ArrowRight, ArrowLeft,
  Navigation, Building2, Banknote, Smartphone, CheckCircle2,
  AlertCircle, UserCircle, LocateFixed, User, Copy, Check,
  ListOrdered, Armchair,
} from "lucide-react";
import { toast } from "sonner";
import {
  copyToClipboard,
  busStatusInfo,
  busAvailabilityLevel,
  AVAILABILITY_COPY,
  BUS_STATUS,
  BUS_STATUS_LEGEND_ORDER,
} from "@/lib/ux";
import { cn } from "@/lib/utils";
import { sortBusesForStudent } from "@/lib/commuter";
import { useFavoriteBus } from "@/hooks/use-favorite-bus";
import { PageShell } from "@/components/PageShell";
import { CrowdBadge } from "@/components/commuter/CrowdBadge";
import { QueueWaitEstimate } from "@/components/commuter/QueueWaitEstimate";
import { FavoriteBusButton } from "@/components/commuter/FavoriteBusButton";

export const Route = createFileRoute("/book")({
  component: BookPage,
  head: () => ({ meta: [{ title: "Book a seat · CoasterBusForU" }] }),
});

type RouteData = {
  name: string; origin: string; destination: string; fare: number;
  originLat?: number; originLng?: number; destLat?: number; destLng?: number;
};
type BusRow = {
  id: string; plateNumber: string; capacity: number; status: string;
  etaMinutes: number; departureTime: string | null;
  route: RouteData | null; activeCount: number; gcashNumber: string;
};
type PickupType = "highway" | "terminal";
type PaymentMethod = "cash" | "gcash";
type Step = "list" | "pickup" | "seat" | "payment" | "confirm";
interface Draft {
  bus: BusRow; pickupType: PickupType;
  preferredSeat: number | null; paymentMethod: PaymentMethod;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function enrichBus(
  id: string,
  data: Record<string, unknown>,
): Promise<BusRow> {
  // Fetch linked route
  let route: RouteData | null = null;
  if (data.routeId) {
    const rSnap = await getDoc(doc(db, "routes", data.routeId as string));
    if (rSnap.exists()) route = rSnap.data() as RouteData;
  }

  // activeTicketCount is maintained atomically on the bus document on every
  // booking, cancellation, and completion — no ticket query needed (and a
  // collection-wide ticket query would be denied by Firestore rules for students).
  const activeCount = (data.activeTicketCount as number) ?? 0;

  // GCash number
  let gcashNumber = "";
  try {
    const gcashSnap = await getDoc(doc(db, "busGcash", id));
    gcashNumber = gcashSnap.exists() ? (gcashSnap.data().gcashNumber ?? "") : "";
  } catch {
    gcashNumber = "";
  }

  return {
    id,
    plateNumber: (data.plateNumber as string) ?? "",
    capacity: (data.capacity as number) ?? 14,
    status: (data.status as string) ?? "idle",
    etaMinutes: (data.etaMinutes as number) ?? 0,
    departureTime: (data.departureTime as string | null) ?? null,
    route,
    activeCount,
    gcashNumber,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────


function BookPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [busesLoading, setBusesLoading] = useState(true);
  const [busesError, setBusesError] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState(true); // optimistic
  const [hasPickupLocation, setHasPickupLocation] = useState(true); // optimistic
  const [step, setStep] = useState<Step>("list");
  const [draft, setDraft] = useState<Partial<Draft>>({});
  const [busy, setBusy] = useState(false);
  const [occupiedSeats, setOccupiedSeats] = useState<Set<number>>(new Set());
  // Direction picker state — compare against short stop names extracted from route
  const [origin, setOrigin] = useState<string>(STOPS[0]);
  const [destination, setDestination] = useState<string>(STOPS[1]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Check if profile is complete
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setProfileComplete(!!(d.fullName?.trim() && d.studentId?.trim()));
        setHasPickupLocation(d.pickupLat != null && d.pickupLng != null);
      } else {
        setProfileComplete(false);
        setHasPickupLocation(false);
      }
    });
  }, [user]);

  // Real-time bus list — re-enriches whenever any bus document changes.
  // activeCount is read directly from buses.activeTicketCount (maintained
  // atomically on every booking/cancel/complete) so no ticket query is needed.
  useEffect(() => {
    if (!user) return;
    setBusesLoading(true);
    setBusesError(null);

    const unsub = onSnapshot(
      collection(db, "buses"),
      async (snap) => {
        try {
          const enriched = await Promise.all(
            snap.docs.map((d) => enrichBus(d.id, d.data() as Record<string, unknown>)),
          );
          const order: Record<string, number> = { boarding: 0, in_transit: 1, idle: 2, arrived: 3 };
          enriched.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
          setBuses(enriched);
          setBusesError(null);
        } catch (err) {
          setBusesError(err instanceof Error ? err.message : "Failed to load buses");
        } finally {
          setBusesLoading(false);
        }
      },
      (err) => {
        console.error("Firestore buses error:", err);
        setBusesError(
          err.code === "permission-denied"
            ? "Access denied. Make sure Firestore security rules are published in the Firebase Console."
            : err.message,
        );
        setBusesLoading(false);
      },
    );
    return unsub;
  }, [user]);

  // Fetch occupied seats for the selected bus from the bus document
  useEffect(() => {
    if (!user || !draft.bus) {
      setOccupiedSeats(new Set());
      return;
    }
    const busId = draft.bus.id;
    const unsub = onSnapshot(doc(db, "buses", busId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const seats = new Set<number>((data.occupiedSeats as number[]) ?? []);
        setOccupiedSeats(seats);
      } else {
        setOccupiedSeats(new Set());
      }
    });
    return unsub;
  }, [user, draft.bus?.id]);

  const confirmBooking = async () => {
    if (!user || !draft.bus || !draft.pickupType || !draft.paymentMethod) return;
    setBusy(true);
    const res = await bookTicket({
      userId: user.uid,
      busId: draft.bus.id,
      pickupType: draft.pickupType,
      preferredSeat: draft.preferredSeat ?? null,
      paymentMethod: draft.paymentMethod,
    });
    setBusy(false);
    if (!res.ok) { toast.error(res.error); return; }
    const t = res.ticket;
    toast.success(
      t.status === "confirmed"
        ? `Seat #${t.seatNumber} confirmed · ${t.ticketCode}`
        : `Queued at #${t.queuePosition} · ${t.ticketCode}`,
    );
    navigate({ to: "/tickets" });
  };

  const back = () => {
    const prev: Record<Step, Step> = {
      list: "list", pickup: "list", seat: "pickup", payment: "seat", confirm: "payment",
    };
    setStep(prev[step]);
  };

  const { favoriteBusId, toggleFavorite, isFavorite } = useFavoriteBus(user?.uid);

  // Filter buses by selected direction.
  // Route origin/destination are stored as "Mansalay, Oriental Mindoro" etc.
  // The STOPS picker uses short names ("Mansalay"), so we match with startsWith.
  const filteredBuses = useMemo(() => {
    return buses.filter(
      (b) =>
        b.route &&
        b.route.origin.startsWith(origin) &&
        b.route.destination.startsWith(destination),
    );
  }, [buses, origin, destination]);

  const sortedBuses = useMemo(
    () => sortBusesForStudent(filteredBuses, favoriteBusId),
    [filteredBuses, favoriteBusId],
  );

  return (
    <PageShell>
      {/* Direction picker shown only on list step */}
      {step === "list" && (
        <div className="mb-6 flex flex-wrap gap-3 items-end animate-fade-in-up">
          <div>
            <label className="block text-xs font-semibold mb-1">Origin</label>
            <select
              className="rounded border border-input bg-background px-2 py-1"
              value={origin}
              onChange={e => {
                setOrigin(e.target.value);
                // If destination is the same as new origin, auto-switch destination
                if (e.target.value === destination) {
                  const next = STOPS.find(s => s !== e.target.value) || STOPS[0];
                  setDestination(next);
                }
              }}
            >
              {STOPS.map(stop => (
                <option key={stop} value={stop}>{stop}</option>
              ))}
            </select>
          </div>
          <span className="mx-2 text-lg font-bold">→</span>
          <div>
            <label className="block text-xs font-semibold mb-1">Destination</label>
            <select
              className="rounded border border-input bg-background px-2 py-1"
              value={destination}
              onChange={e => setDestination(e.target.value)}
            >
              {STOPS.filter(s => s !== origin).map(stop => (
                <option key={stop} value={stop}>{stop}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {step !== "list" && (
        <div className="mb-6 sm:mb-8 animate-fade-in">
          <button
            onClick={back}
            className="btn-press mb-4 flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {draft.bus && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
              <Bus className="h-4 w-4 text-amber" />
              <span className="font-mono font-semibold">{draft.bus.plateNumber}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{draft.bus.route?.name ?? "Route"}</span>
            </div>
          )}
          <StepIndicator current={step} />
        </div>
      )}

      <div key={step} className="animate-fade-in-up">
        {step === "list" && (
          <BusList
            buses={sortedBuses}
            isLoading={busesLoading}
            error={busesError}
            profileComplete={profileComplete}
            hasPickupLocation={hasPickupLocation}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            onSelect={(b) => { setDraft({ bus: b }); setStep("pickup"); }}
          />
        )}
        {step === "pickup" && draft.bus && (
          <PickupStep
            bus={draft.bus}
            onSelect={(t) => { setDraft((d) => ({ ...d, pickupType: t })); setStep("seat"); }}
          />
        )}
        {step === "seat" && draft.bus && (
          <SeatStep
            bus={draft.bus}
            occupiedSeats={occupiedSeats}
            onSelect={(s) => { setDraft((d) => ({ ...d, preferredSeat: s })); setStep("payment"); }}
          />
        )}
        {step === "payment" && draft.bus && (
          <PaymentStep
            bus={draft.bus}
            onSelect={(m) => { setDraft((d) => ({ ...d, paymentMethod: m })); setStep("confirm"); }}
          />
        )}
        {step === "confirm" && draft.bus && draft.pickupType && draft.paymentMethod && (
          <ConfirmStep draft={draft as Draft} busy={busy} onConfirm={confirmBooking} />
        )}
      </div>
    </PageShell>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: "pickup", label: "Pickup" },
  { key: "seat", label: "Seat" },
  { key: "payment", label: "Payment" },
  { key: "confirm", label: "Confirm" },
];

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all
            ${i < idx ? "bg-success text-white" : i === idx ? "bg-primary text-primary-foreground ring-2 ring-primary/20" : "bg-secondary text-muted-foreground"}`}>
            {i < idx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          <span className={`text-sm font-medium whitespace-nowrap ${i === idx ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
          {i < STEPS.length - 1 && <div className={`h-px w-8 transition-colors ${i < idx ? "bg-success" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

// ── Bus status & availability UI ─────────────────────────────────────────────

function BusStatusLegend() {
  return (
    <details className="group mb-6 rounded-xl border border-border bg-card transition-shadow open:shadow-md card-interactive">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          <span>What do bus statuses mean?</span>
          <span className="text-xs font-normal text-muted-foreground group-open:hidden">Tap to learn</span>
        </span>
      </summary>
      <ul className="space-y-3 border-t border-border px-4 py-3">
        {BUS_STATUS_LEGEND_ORDER.map((key) => {
          const s = BUS_STATUS[key];
          return (
            <li key={key} className="flex gap-3 text-sm">
              <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", s.dotClass)} />
              <div>
                <p className="font-semibold">{s.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function BusStatusBanner({ status }: { status: string }) {
  const info = busStatusInfo(status);
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", info.className)}>
      <div className="flex items-start gap-2.5">
        <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", info.dotClass)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{info.label}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-90">{info.description}</p>
          {info.studentTip && (
            <p className="mt-1.5 text-xs font-medium opacity-80">Tip: {info.studentTip}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CoasterSeatMap({
  capacity,
  filled,
  occupiedSeats,
  selectedSeat,
  interactive,
  onSeatClick,
}: {
  capacity: number;
  filled: number;
  occupiedSeats?: Set<number>;
  selectedSeat?: number | null;
  interactive?: boolean;
  onSeatClick?: (n: number) => void;
}) {
  const isSeatTaken = (seatNum: number, index: number) =>
    occupiedSeats ? occupiedSeats.has(seatNum) : index < filled;

  return (
    <div className="rounded-lg bg-surface/80 p-3">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>Front · Driver</span>
        <span>Rear</span>
      </div>
      <div className="mx-auto max-w-xs">
        <div className="mb-1.5 rounded-t-lg border border-b-0 border-border bg-muted/50 px-2 py-1 text-center text-[10px] font-medium text-muted-foreground">
          Windshield
        </div>
        <div className="grid grid-cols-7 gap-1.5 rounded-b-lg border border-border bg-card p-2">
          {Array.from({ length: capacity }, (_, i) => {
            const seatNum = i + 1;
            const taken = isSeatTaken(seatNum, i);
            const selected = selectedSeat === seatNum;
            const CellTag = interactive && !taken ? "button" : "div";
            return (
              <CellTag
                key={seatNum}
                type={CellTag === "button" ? "button" : undefined}
                disabled={taken}
                onClick={interactive && !taken ? () => onSeatClick?.(seatNum) : undefined}
                title={taken ? `Seat ${seatNum} — taken` : `Seat ${seatNum} — available`}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md text-[11px] font-bold transition",
                  taken && "cursor-not-allowed bg-primary/80 text-primary-foreground",
                  !taken && !selected && "bg-secondary text-foreground border border-border",
                  !taken && selected && "ring-2 ring-amber bg-amber text-accent-foreground",
                  interactive && !taken && !selected && "hover:border-primary hover:bg-primary/10",
                )}
              >
                {taken ? <User className="h-3.5 w-3.5" /> : seatNum}
              </CellTag>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-secondary border border-border" /> Open
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-primary/80" /> Booked
        </span>
        {interactive && (
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded ring-2 ring-amber bg-amber" /> Your pick
          </span>
        )}
      </div>
    </div>
  );
}

function BusAvailabilityPanel({ bus }: { bus: BusRow }) {
  const filled = Math.min(bus.activeCount, bus.capacity);
  const queueAhead = Math.max(0, bus.activeCount - bus.capacity);
  const available = Math.max(0, bus.capacity - filled);
  const level = busAvailabilityLevel(filled, bus.capacity);
  const avail = AVAILABILITY_COPY[level];
  const pct = Math.min(100, Math.round((filled / bus.capacity) * 100));
  const barColor =
    level === "queue" || level === "full"
      ? "bg-destructive"
      : level === "filling"
        ? "bg-warning"
        : "bg-success";

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", avail.className)}>
            {avail.label}
          </span>
          <CrowdBadge filled={filled} capacity={bus.capacity} />
        </div>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Armchair className="h-3.5 w-3.5" />
          <strong className="text-foreground">{available}</strong>
          <span>of {bus.capacity} open</span>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap justify-between gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{filled} booked</span>
        {queueAhead > 0 ? (
          <span className="flex items-center gap-1 font-semibold normal-case text-warning">
            <ListOrdered className="h-3 w-3" />
            {queueAhead} in FIFO queue
          </span>
        ) : (
          <span>{available} available</span>
        )}
      </div>
      <CoasterSeatMap capacity={bus.capacity} filled={filled} />
    </div>
  );
}

// ── Step 0: Bus list ──────────────────────────────────────────────────────────

function BusList({
  buses, isLoading, error, profileComplete, hasPickupLocation, isFavorite, onToggleFavorite, onSelect,
}: {
  buses: BusRow[];
  isLoading: boolean;
  error: string | null;
  profileComplete: boolean;
  hasPickupLocation: boolean;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (busId: string, plate?: string) => void;
  onSelect: (b: BusRow) => void;
}) {
  return (
    <>
      <div className="mb-6 animate-fade-in-up">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Book a seat</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Choose a bus · tap <span className="inline-flex align-middle">★</span> to pin your usual coaster
        </p>
      </div>

      {/* Profile incomplete banner */}
      {!profileComplete && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="font-semibold text-warning-foreground">Complete your profile first</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Your full name and student ID are required for ticket verification by the conductor.
            </p>
          </div>
          <Link to="/profile">
            <Button size="sm" variant="outline" className="gap-1 shrink-0">
              <UserCircle className="h-4 w-4" /> Set up profile
            </Button>
          </Link>
        </div>
      )}

      {/* Pickup location banner — shown when student hasn't saved a pickup point */}
      {!hasPickupLocation && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
          <LocateFixed className="mt-0.5 h-5 w-5 shrink-0 text-accent-foreground" />
          <div className="flex-1">
            <p className="font-semibold text-accent-foreground">Save your highway pickup location</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Let the bus alert you when it's approaching your pickup point. Only needed for highway pick-up tickets.
            </p>
          </div>
          <Link to="/profile">
            <Button size="sm" variant="outline" className="gap-1 shrink-0">
              <MapPin className="h-4 w-4" /> Set location
            </Button>
          </Link>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm">
          <p className="font-semibold text-destructive">Could not load buses</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
          {error.includes("permission-denied") || error.includes("Access denied") ? (
            <div className="mt-3 rounded-lg bg-card p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Fix: Publish Firestore security rules</p>
              <p>1. Go to <a href="https://console.firebase.google.com/project/coasterbus-d99b9/firestore/rules" target="_blank" rel="noopener noreferrer" className="text-primary underline">Firebase Console → Firestore → Rules</a></p>
              <p>2. Paste the contents of <code className="bg-muted px-1 rounded">firestore.rules</code> from your project</p>
              <p>3. Click <strong>Publish</strong></p>
            </div>
          ) : null}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !error && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6 skeleton-shimmer">
              <div className="h-5 w-32 rounded bg-secondary" />
              <div className="mt-3 h-4 w-48 rounded bg-secondary" />
              <div className="mt-4 grid grid-cols-7 gap-1.5">
                {Array.from({ length: 14 }).map((_, j) => (
                  <div key={j} className="aspect-square rounded bg-secondary" />
                ))}
              </div>
              <div className="mt-5 h-10 w-full rounded bg-secondary" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && buses.length > 0 && <BusStatusLegend />}

      {/* Empty state */}
      {!isLoading && !error && buses.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <Bus className="mx-auto mb-3 h-10 w-10" />
          <p>No buses scheduled right now. Check back soon.</p>
        </div>
      )}

      {/* Bus cards */}
      {!error && (
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          {buses.map((b, index) => {
            const filled = Math.min(b.activeCount, b.capacity);
            const queueAhead = Math.max(0, b.activeCount - b.capacity);
            const willQueue = b.activeCount >= b.capacity;
            const tripEnded = b.status === "arrived";
            const info = busStatusInfo(b.status);
            const fav = isFavorite(b.id);
            const stagger = ["stagger-1", "stagger-2", "stagger-3", "stagger-4"][index % 4];

            return (
              <div
                key={b.id}
                className={cn(
                  "group card-interactive flex flex-col overflow-hidden rounded-xl border bg-card animate-fade-in-up",
                  stagger,
                  tripEnded ? "border-border opacity-90" : "border-border hover:border-primary/40",
                  fav && "ring-2 ring-amber/30 shadow-md shadow-amber/10",
                )}
              >
                <BusStatusBanner status={b.status} />

                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Bus className="h-5 w-5 shrink-0 text-amber" />
                        <span className="font-mono text-base font-semibold sm:text-lg">{b.plateNumber}</span>
                        {fav && (
                          <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber">
                            Your bus
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 font-display text-xl font-semibold">{b.route?.name ?? "—"}</h3>
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {b.route?.origin} → {b.route?.destination}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <FavoriteBusButton
                        active={fav}
                        onToggle={() => onToggleFavorite(b.id, b.plateNumber)}
                      />
                      <div className="text-right">
                        <div className="font-display text-2xl font-bold text-amber sm:text-3xl">
                          ₱{b.route?.fare?.toFixed(2) ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">per seat</div>
                      </div>
                    </div>
                  </div>

                  <BusAvailabilityPanel bus={b} />

                  <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      ETA <strong className="text-foreground">{b.etaMinutes} min</strong>
                    </span>
                    {b.departureTime && (
                      <span className="text-xs text-muted-foreground">Departs {b.departureTime}</span>
                    )}
                  </div>

                  {willQueue && !tripEnded && (
                    <div className="mt-3 space-y-2">
                      <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                        All {b.capacity} seats are taken. FIFO queue position{" "}
                        <strong>#{b.activeCount + 1}</strong>.
                      </p>
                      <QueueWaitEstimate
                        queuePosition={b.activeCount + 1}
                        busEtaMinutes={b.etaMinutes}
                        busStatus={b.status}
                      />
                    </div>
                  )}

                  {tripEnded && (
                    <p className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      {info.studentTip}
                    </p>
                  )}

                  <Button
                    className="btn-press mt-5 w-full min-h-[48px] sm:min-h-[52px]"
                    onClick={() => {
                      if (!profileComplete) {
                        toast.error("Complete your profile before booking.");
                        return;
                      }
                      if (tripEnded) {
                        toast.info("This trip has ended. Wait for the next boarding round.");
                        return;
                      }
                      onSelect(b);
                    }}
                    disabled={!profileComplete || tripEnded}
                    variant={willQueue ? "outline" : "default"}
                    size="lg"
                  >
                    {tripEnded
                      ? "Trip finished"
                      : willQueue
                        ? `Join queue (#${b.activeCount + 1})`
                        : "Book a seat"}
                    {!tripEnded && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Step 1: Pickup type ───────────────────────────────────────────────────────

function PickupStep({ bus, onSelect }: { bus: BusRow; onSelect: (t: PickupType) => void }) {
  return (
    <div className="mx-auto max-w-lg">
      <h2 className="font-display text-2xl font-bold">How will you board?</h2>
      <p className="mt-1 text-muted-foreground">{bus.plateNumber} · {bus.route?.name}</p>
      <div className="mt-8 grid gap-4">
        <OptionCard
          icon={<Navigation className="h-8 w-8" />}
          title="Highway pick-up"
          desc="Wait on the highway at your location. The bus will stop for you."
          onClick={() => onSelect("highway")}
        />
        <OptionCard
          icon={<Building2 className="h-8 w-8" />}
          title="Terminal boarding"
          desc="Go to the terminal and board from there."
          onClick={() => onSelect("terminal")}
        />
      </div>
    </div>
  );
}

// ── Step 2: Seat preference ───────────────────────────────────────────────────

function SeatStep({ bus, onSelect, occupiedSeats }: { bus: BusRow; onSelect: (s: number | null) => void; occupiedSeats: Set<number> }) {
  const [selected, setSelected] = useState<number | null>(null);
  const filled = Math.min(bus.activeCount, bus.capacity);
  const openSeats = bus.capacity - occupiedSeats.size;
  const willQueue = bus.activeCount >= bus.capacity;

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="font-display text-2xl font-bold">Choose your seat</h2>
      <p className="mt-1 text-muted-foreground">
        Tap an open seat, or let us assign the next one in <strong>FIFO</strong> order.
      </p>

      <div className="mt-4">
        <BusStatusBanner status={bus.status} />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", AVAILABILITY_COPY[busAvailabilityLevel(filled, bus.capacity)].className)}>
            {AVAILABILITY_COPY[busAvailabilityLevel(filled, bus.capacity)].label}
          </span>
          <span className="text-muted-foreground">
            <strong className="text-foreground">{openSeats}</strong> seats still open on this bus
          </span>
        </div>
        {willQueue && (
          <p className="mt-2 text-xs text-warning-foreground">
            Bus is at capacity — you may receive a queue number instead of your preferred seat.
          </p>
        )}
      </div>

      <div className="mt-6">
        <CoasterSeatMap
          capacity={bus.capacity}
          filled={filled}
          occupiedSeats={occupiedSeats}
          selectedSeat={selected}
          interactive
          onSeatClick={setSelected}
        />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <Button
          className="w-full"
          size="lg"
          disabled={selected == null}
          onClick={() => selected != null && onSelect(selected)}
        >
          {selected != null ? `Continue with seat #${selected}` : "Select a seat above"}
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" className="w-full" onClick={() => onSelect(null)}>
          No preference — auto-assign next available (FIFO)
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Payment method ────────────────────────────────────────────────────

function GcashCopyButton({ number }: { number: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const ok = await copyToClipboard(number);
    if (ok) {
      setCopied(true);
      toast.success("GCash number copied");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Could not copy — select the number manually");
    }
  };
  return (
    <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5" onClick={handleCopy}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : "Copy number"}
    </Button>
  );
}

function PaymentStep({ bus, onSelect }: { bus: BusRow; onSelect: (m: PaymentMethod) => void }) {
  return (
    <div className="mx-auto max-w-lg">
      <h2 className="font-display text-2xl font-bold">Payment method</h2>
      <p className="mt-1 text-muted-foreground">
        {bus.plateNumber} · ₱{bus.route?.fare?.toFixed(2)}
      </p>
      <div className="mt-8 grid gap-4">
        <OptionCard
          icon={<Banknote className="h-8 w-8" />}
          title="Cash on board"
          desc="Pay the conductor in cash when you board the bus."
          onClick={() => onSelect("cash")}
        />
        <OptionCard
          icon={<Smartphone className="h-8 w-8" />}
          title="GCash"
          desc={
            bus.gcashNumber
              ? `Send ₱${bus.route?.fare?.toFixed(2)} to GCash number: ${bus.gcashNumber}`
              : "GCash number not yet set for this bus. Contact the operator."
          }
          disabled={!bus.gcashNumber}
          onClick={() => onSelect("gcash")}
        />
      </div>
      {bus.gcashNumber && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-semibold">GCash number for {bus.plateNumber}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-amber">{bus.gcashNumber}</p>
          <GcashCopyButton number={bus.gcashNumber} />
          <p className="mt-2 text-xs text-muted-foreground">
            Send the exact fare before boarding. The conductor will verify your payment.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Step 4: Confirm ───────────────────────────────────────────────────────────

function ConfirmStep({
  draft, busy, onConfirm,
}: { draft: Draft; busy: boolean; onConfirm: () => void }) {
  const { bus, pickupType, preferredSeat, paymentMethod } = draft;
  return (
    <div className="mx-auto max-w-lg">
      <h2 className="font-display text-2xl font-bold">Confirm booking</h2>
      <p className="mt-1 text-muted-foreground">Review your details before confirming.</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <div className="bg-surface px-5 py-3 text-surface-foreground">
          <span className="flex items-center gap-2 font-mono text-sm font-semibold">
            <Bus className="h-4 w-4 text-amber" /> {bus.plateNumber}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 p-5">
          <SummaryRow label="Route" value={bus.route?.name ?? "—"} />
          <SummaryRow label="Fare" value={`₱${bus.route?.fare?.toFixed(2)}`} />
          <SummaryRow
            label="Boarding"
            value={pickupType === "highway" ? "Highway pick-up" : "Terminal"}
          />
          <SummaryRow
            label="Preferred seat"
            value={preferredSeat ? `#${preferredSeat}` : "Auto-assign"}
          />
          <SummaryRow
            label="Payment"
            value={paymentMethod === "gcash" ? "GCash" : "Cash on board"}
          />
          {paymentMethod === "gcash" && bus.gcashNumber && (
            <SummaryRow label="GCash no." value={bus.gcashNumber} />
          )}
        </div>
      </div>

      {paymentMethod === "gcash" && bus.gcashNumber && (
        <div className="mt-4 rounded-xl border border-amber/30 bg-amber/10 p-4 text-sm">
          <p className="font-semibold text-amber">GCash reminder</p>
          <p className="mt-1 text-foreground/80">
            Send <strong>₱{bus.route?.fare?.toFixed(2)}</strong> to{" "}
            <strong className="font-mono">{bus.gcashNumber}</strong> before boarding.
            The conductor will verify your payment.
          </p>
          <GcashCopyButton number={bus.gcashNumber} />
        </div>
      )}
      {paymentMethod === "cash" && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Pay <strong>₱{bus.route?.fare?.toFixed(2)}</strong> in cash to the conductor when you board.
        </div>
      )}

      <Button className="mt-6 w-full" size="lg" onClick={onConfirm} disabled={busy}>
        {busy ? "Booking…" : "Confirm booking"}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function OptionCard({
  icon, title, desc, onClick, disabled,
}: {
  icon: React.ReactNode; title: string; desc: string;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group card-interactive flex min-h-[72px] items-start gap-4 rounded-xl border p-4 text-left sm:p-5",
        disabled
          ? "cursor-not-allowed border-border bg-muted opacity-50"
          : "border-border bg-card hover:border-primary",
      )}
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition
        ${disabled
          ? "bg-secondary text-muted-foreground"
          : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"}`}>
        {icon}
      </div>
      <div>
        <div className="font-display text-base font-semibold">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
      </div>
      {!disabled && (
        <ArrowRight className="ml-auto mt-1 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
      )}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

