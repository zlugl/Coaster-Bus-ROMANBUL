import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase";
import { useAuth } from "@/hooks/use-auth";
import { cancelTicket, completeTicket, deleteTicket } from "@/lib/tickets.functions";
import { cacheOfflineTicket, readOfflineTicket } from "@/lib/commuter";
import { ticketStatusClass, ticketStatusLabel } from "@/lib/ux";
import { PageShell } from "@/components/PageShell";
import { QueueWaitEstimate } from "@/components/commuter/QueueWaitEstimate";
import { ShareTicketButton } from "@/components/commuter/ShareTicketButton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Ticket as TicketIcon,
  Bus,
  X,
  QrCode,
  Navigation,
  Building2,
  Banknote,
  Smartphone,
  CheckCircle2,
  Clock,
  MapPin,
  LocateFixed,
  Check,
  Trash2,
  Map,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

export const Route = createFileRoute("/tickets")({
  component: TicketsPage,
  head: () => ({ meta: [{ title: "My Tickets · CoasterBusForU" }] }),
});

type Ticket = {
  id: string;
  ticketCode: string;
  seatNumber: number | null;
  preferredSeat: number | null;
  queuePosition: number;
  status: string;
  pickupType: "highway" | "terminal";
  paymentMethod: "cash" | "gcash";
  paymentStatus: "pending" | "paid";
  createdAt: { seconds: number } | null;
  busPlate?: string;
  busEta?: number;
  busStatus?: string;
  routeName?: string;
  routeOrigin?: string;
  routeDest?: string;
};

const ACTIVE_STATUSES = ["queued", "confirmed"];

function TicketsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [expandedQr, setExpandedQr] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<{ fullName: string; studentId: string } | null>(null);
  const [hasPickupLocation, setHasPickupLocation] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((s) => {
      if (s.exists()) {
        setProfile({ fullName: s.data().fullName ?? "", studentId: s.data().studentId ?? "" });
        setHasPickupLocation(s.data().pickupLat != null && s.data().pickupLng != null);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "tickets"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const rows = await Promise.all(
        snap.docs.map(async (d) => {
          const t = { id: d.id, ...d.data() } as Record<string, unknown> & { id: string };
          let busPlate = "",
            busEta = 0,
            busStatus = "",
            routeName = "",
            routeOrigin = "",
            routeDest = "";
          if (t.busId) {
            const bSnap = await getDoc(doc(db, "buses", t.busId as string));
            if (bSnap.exists()) {
              const b = bSnap.data();
              busPlate = b.plateNumber ?? "";
              busEta = b.etaMinutes ?? 0;
              busStatus = b.status ?? "";
              if (b.routeId) {
                const rSnap = await getDoc(doc(db, "routes", b.routeId));
                if (rSnap.exists()) {
                  const r = rSnap.data();
                  routeName = r.name ?? "";
                  routeOrigin = r.origin ?? "";
                  routeDest = r.destination ?? "";
                }
              }
            }
          }
          return {
            ...t,
            busPlate,
            busEta,
            busStatus,
            routeName,
            routeOrigin,
            routeDest,
          } as unknown as Ticket;
        }),
      );
      rows.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setTickets(rows);
    });
    return unsub;
  }, [user]);

  // Auto-show QR for the newest active ticket + cache for offline
  useEffect(() => {
    const active = tickets.find((t) => ACTIVE_STATUSES.includes(t.status));
    if (active) {
      setExpandedQr((prev) => {
        if (prev.has(active.id)) return prev;
        const n = new Set(prev);
        n.add(active.id);
        return n;
      });
      if (user && profile) {
        const qrPayload = JSON.stringify({
          code: active.ticketCode,
          name: profile.fullName,
          student_id: profile.studentId,
          payment: active.paymentMethod,
          paid: active.paymentStatus === "paid",
        });
        cacheOfflineTicket(user.uid, {
          ticketCode: active.ticketCode,
          routeName: active.routeName ?? "",
          busPlate: active.busPlate ?? "",
          qrPayload,
          savedAt: Date.now(),
        });
        setOfflineReady(true);
      }
    }
  }, [tickets, user, profile]);

  useEffect(() => {
    if (!user) return;
    const cached = readOfflineTicket(user.uid);
    setOfflineReady(!!cached);
  }, [user, tickets]);

  const activeTickets = tickets.filter((t) => ACTIVE_STATUSES.includes(t.status));
  const pastTickets = tickets.filter((t) => !ACTIVE_STATUSES.includes(t.status));
  const heroTicket = activeTickets[0] ?? null;

  const toggleQr = (id: string) =>
    setExpandedQr((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const handleMarkArrived = async (ticketId: string) => {
    if (!user) return;
    const r = await completeTicket({ ticketId, userId: user.uid });
    if (r.ok) toast.success("Trip marked complete — your seat is now free for others");
    else toast.error(r.error);
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!user) return;
    const r = await deleteTicket({ ticketId, userId: user.uid });
    if (r.ok) toast.success("Ticket removed from history");
    else toast.error(r.error);
  };

  const confirmCancel = async () => {
    if (!user || !cancelId) return;
    setCancelling(true);
    const r = await cancelTicket({ ticketId: cancelId, userId: user.uid });
    setCancelling(false);
    setCancelId(null);
    if (r.ok) toast.success("Booking cancelled");
    else toast.error(r.error);
  };

  return (
    <PageShell>
        <div className="animate-fade-in-up">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">My tickets</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Your active ride and booking history
        </p>
        {offlineReady && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <WifiOff className="h-3.5 w-3.5 text-success" />
            Latest ticket saved on this device for weak-signal areas
          </p>
        )}

        {!hasPickupLocation && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
            <LocateFixed className="mt-0.5 h-5 w-5 shrink-0 text-accent-foreground" />
            <div className="flex-1">
              <p className="font-semibold text-accent-foreground">Save your highway pickup location</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Get alerts when the bus is approaching your pickup point.
              </p>
            </div>
            <Link to="/profile">
              <Button size="sm" variant="outline" className="gap-1 shrink-0">
                <MapPin className="h-4 w-4" /> Set location
              </Button>
            </Link>
          </div>
        )}

        {tickets.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-border p-12 text-center">
            <TicketIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold text-foreground">No tickets yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">Book your first seat to get started</p>
            <Link to="/book">
              <Button className="mt-4" size="lg">
                Book a seat
              </Button>
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {heroTicket && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Your ride now
                </h2>
                <TicketCard
                  t={heroTicket}
                  profile={profile}
                  variant="hero"
                  showQr={expandedQr.has(heroTicket.id)}
                  onToggleQr={() => toggleQr(heroTicket.id)}
                  onCancel={() => setCancelId(heroTicket.id)}
                  onMarkArrived={() => handleMarkArrived(heroTicket.id)}
                />
                <Link
                  to="/tracking"
                  className="card-interactive mt-3 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-medium hover:border-primary/50"
                >
                  <Map className="h-4 w-4 text-amber" />
                  Track bus on map
                </Link>
              </section>
            )}

            {activeTickets.length > 1 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Other active bookings
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {activeTickets.slice(1).map((t) => (
                    <TicketCard
                      key={t.id}
                      t={t}
                      profile={profile}
                      showQr={expandedQr.has(t.id)}
                      onToggleQr={() => toggleQr(t.id)}
                      onCancel={() => setCancelId(t.id)}
                      onMarkArrived={() => handleMarkArrived(t.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {pastTickets.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Past trips
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {pastTickets.map((t) => (
                    <TicketCard
                      key={t.id}
                      t={t}
                      profile={profile}
                      showQr={expandedQr.has(t.id)}
                      onToggleQr={() => toggleQr(t.id)}
                      onDelete={() => handleDeleteTicket(t.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
        </div>

      <AlertDialog open={cancelId != null} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Your seat or queue position will be released for other students. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                confirmCancel();
              }}
            >
              {cancelling ? "Cancelling…" : "Yes, cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function TicketCard({
  t,
  profile,
  variant = "default",
  showQr,
  onToggleQr,
  onCancel,
  onMarkArrived,
  onDelete,
}: {
  t: Ticket;
  profile: { fullName: string; studentId: string } | null;
  variant?: "default" | "hero";
  showQr: boolean;
  onToggleQr: () => void;
  onCancel?: () => void;
  onMarkArrived?: () => void;
  onDelete?: () => void;
}) {
  const isActive = ACTIVE_STATUSES.includes(t.status);
  const isQueued = t.status === "queued";
  const isPaid = t.paymentStatus === "paid";
  const liveQueueDisplay = isQueued
    ? `#${t.queuePosition} in queue`
    : t.seatNumber
      ? `Seat #${t.seatNumber}`
      : `#${t.queuePosition}`;
  const qrPayload = JSON.stringify({
    code: t.ticketCode,
    name: profile?.fullName ?? "",
    student_id: profile?.studentId ?? "",
    payment: t.paymentMethod,
    paid: isPaid,
  });

  const isHero = variant === "hero";

  const seatOrQueue = isQueued
    ? `Queue #${t.queuePosition}`
    : t.seatNumber
      ? `Seat #${t.seatNumber}`
      : `Queue #${t.queuePosition}`;

  return (
    <div
      className={cn(
        "group card-interactive overflow-hidden rounded-xl border bg-card animate-fade-in-up",
        isHero ? "border-amber/40 ring-2 ring-amber/20 shadow-lg shadow-amber/10" : "border-border",
      )}
    >
      <div className="flex items-center justify-between bg-surface px-5 py-4 text-surface-foreground">
        <div className="flex items-center gap-3">
          <Bus className="h-5 w-5 text-amber" />
          <span className="font-mono text-base font-semibold">{t.busPlate}</span>
        </div>
        <StatusPill status={t.status} />
      </div>

      <div className={`grid gap-5 p-5 ${isHero ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`}>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Ticket code</div>
          <div className={`mt-1 font-mono font-bold text-amber ${isHero ? "text-3xl" : "text-2xl"}`}>
            {t.ticketCode}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {t.seatNumber ? "Seat" : "Queue position"}
          </div>
          <div className={`mt-1 font-display font-bold ${isHero ? "text-4xl" : "text-2xl"}`}>
            {liveQueueDisplay}
          </div>
          {isQueued && (
            <>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-amber">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber" />
                Live · updates automatically
              </div>
              {isHero && (
                <div className="mt-3">
                  <QueueWaitEstimate
                    queuePosition={t.queuePosition}
                    busEtaMinutes={t.busEta ?? 0}
                    busStatus={t.busStatus ?? "idle"}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className={isHero ? "sm:col-span-2" : "col-span-2"}>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Route</div>
          <div className="mt-1 text-base font-medium">{t.routeName}</div>
          <div className="text-xs text-muted-foreground">
            {t.routeOrigin} → {t.routeDest}
          </div>
        </div>

        <div className={`flex flex-wrap gap-2 ${isHero ? "sm:col-span-2" : "col-span-2"}`}>
          <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium">
            {t.pickupType === "highway" ? (
              <>
                <Navigation className="h-3.5 w-3.5" /> Highway pick-up
              </>
            ) : (
              <>
                <Building2 className="h-3.5 w-3.5" /> Terminal
              </>
            )}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium">
            {t.paymentMethod === "gcash" ? (
              <>
                <Smartphone className="h-3.5 w-3.5" /> GCash
              </>
            ) : (
              <>
                <Banknote className="h-3.5 w-3.5" /> Cash
              </>
            )}
          </span>
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              isPaid ? "bg-success/15 text-success" : "bg-warning/15 text-warning-foreground"
            }`}
          >
            {isPaid ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Paid
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5" /> Not yet paid
              </>
            )}
          </span>
        </div>

        {isHero && isActive && (
          <div className="sm:col-span-2 flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-4 py-6 animate-scale-in">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Show conductor when boarding
            </p>
            <QRCodeSVG
              value={qrPayload}
              size={200}
              bgColor="#ffffff"
              fgColor="#0f2847"
              level="M"
              includeMargin
            />
            <span
              className={`rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-widest ${
                isPaid ? "bg-success/20 text-success" : "bg-warning/20 text-warning-foreground"
              }`}
            >
              {isPaid ? "✓ PAID" : "NOT YET PAID"}
            </span>
          </div>
        )}

        <div
          className={`flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between ${
            isHero ? "sm:col-span-2" : "col-span-2"
          }`}
        >
          <div className="flex items-center gap-1.5 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" /> ETA <strong>{t.busEta} min</strong>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            {isActive && (
              <ShareTicketButton
                ticketCode={t.ticketCode}
                routeName={t.routeName ?? ""}
                busPlate={t.busPlate ?? ""}
                seatOrQueue={seatOrQueue}
              />
            )}
            {!isHero && (
              <Button size="sm" variant="outline" className="btn-press gap-1.5" onClick={onToggleQr}>
                <QrCode className="h-4 w-4" />
                {showQr ? "Hide QR" : "Show QR"}
              </Button>
            )}
            {isActive && onCancel && (
              <Button size="sm" variant="ghost" className="btn-press" onClick={onCancel}>
                <X className="h-4 w-4" /> Cancel
              </Button>
            )}
            {isActive && onMarkArrived && (
              <Button size="sm" variant="default" className="btn-press col-span-2 gap-1.5 sm:col-span-1" onClick={onMarkArrived}>
                <Check className="h-4 w-4" /> End trip
              </Button>
            )}
            {t.status === "completed" && onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="btn-press gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      {!isHero && showQr && (
        <div className="flex flex-col items-center gap-4 border-t border-border bg-white px-5 py-8">
          <QRCodeSVG
            value={qrPayload}
            size={180}
            bgColor="#ffffff"
            fgColor="#0f2847"
            level="M"
            includeMargin
          />
          <span
            className={`rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-widest ${
              isPaid ? "bg-success/20 text-success" : "bg-warning/20 text-warning-foreground"
            }`}
          >
            {isPaid ? "✓ PAID" : "NOT YET PAID"}
          </span>
          <div className="space-y-1 text-center text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{profile?.fullName}</p>
            {profile?.studentId && <p>ID: {profile.studentId}</p>}
            <p className="font-mono font-bold tracking-widest text-foreground">{t.ticketCode}</p>
          </div>
          <p className="text-center text-xs text-muted-foreground">Show this QR to the conductor when boarding</p>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${ticketStatusClass(status)}`}
    >
      {ticketStatusLabel(status)}
    </span>
  );
}
