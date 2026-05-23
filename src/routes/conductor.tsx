import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, getDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "@/integrations/firebase";
import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/hooks/use-auth";
import { verifyPayment } from "@/lib/tickets.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield, Ticket as TicketIcon, CheckCircle2, XCircle, Users, Search, Camera, CameraOff, Banknote, Smartphone, Navigation, Building2, User } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

export const Route = createFileRoute("/conductor")({
  component: ConductorPage,
  head: () => ({ meta: [{ title: "Conductor console · CoasterBusForU" }] }),
});

type BusOpt = { id: string; plateNumber: string; routeName: string; capacity: number };
type Manifest = { id: string; ticketCode: string; status: string; seatNumber: number | null; queuePosition: number; pickupType: string; paymentMethod: string; paymentStatus: string; userId: string; fullName?: string; studentId?: string };

function QrScanner({ onScan }: { onScan: (code: string) => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Use a stable unique ID tied to this component instance
  const idRef = useRef(`qr-scanner-${Math.random().toString(36).slice(2)}`);

  const stop = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      scannerRef.current?.clear();
    } catch { /* ignore */ }
    scannerRef.current = null;
    setActive(false);
  };

  const start = async () => {
    setError(null);
    // Stop any existing instance first
    await stop();

    // Ensure the container element is in the DOM before initialising
    const el = document.getElementById(idRef.current);
    if (!el) {
      setError("Scanner container not found. Please try again.");
      return;
    }

    try {
      const scanner = new Html5Qrcode(idRef.current);
      scannerRef.current = scanner;
      // Show the container before starting so it has non-zero dimensions
      setActive(true);
      // Small delay to let React flush the visibility change before the library
      // tries to measure the element and inject the <video> tag.
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          onScan(decodedText.trim());
        },
        undefined,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera unavailable");
      scannerRef.current = null;
      setActive(false);
    }
  };

  // Clean up on unmount
  useEffect(() => () => { stop(); }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {!active ? (
          <Button onClick={start} variant="outline" className="gap-2">
            <Camera className="h-4 w-4" /> Scan QR
          </Button>
        ) : (
          <Button onClick={stop} variant="secondary" className="gap-2">
            <CameraOff className="h-4 w-4" /> Stop camera
          </Button>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      {/*
        The container must always be in the DOM so html5-qrcode can find it by ID.
        We use visibility + height instead of display:none so the element always
        has a measurable size when the library injects the <video> tag.
      */}
      <div
        id={idRef.current}
        ref={containerRef}
        className="overflow-hidden rounded-xl border border-border bg-black"
        style={{
          width: "100%",
          maxWidth: 320,
          // Keep the element in the layout flow but invisible when not active,
          // so html5-qrcode always finds a container with real dimensions.
          height: active ? undefined : 0,
          border: active ? undefined : "none",
        }}
      />
    </div>
  );
}

function ConductorPage() {
  const { user, loading, isConductor, roles } = useAuth();
  const navigate = useNavigate();
  const [buses, setBuses] = useState<BusOpt[]>([]);
  const [busId, setBusId] = useState("");
  const [manifest, setManifest] = useState<Manifest[]>([]);
  const [scanCode, setScanCode] = useState("");
  const [granting, setGranting] = useState(false);
  // Keep a ref to manifest so the QR scanner callback always sees the latest
  const manifestRef = useRef<Manifest[]>([]);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const grantConductor = async () => {
    if (!user) return;
    setGranting(true);
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const existing: string[] = snap.data()?.roles ?? ["student"];
    if (!existing.includes("conductor")) await updateDoc(ref, { roles: [...existing, "conductor"] });
    setGranting(false);
    toast.success("Conductor access granted.");
    setTimeout(() => location.reload(), 500);
  };

  useEffect(() => {
    if (!isConductor) return;
    const unsub = onSnapshot(collection(db, "buses"), async (snap) => {
      const rows = await Promise.all(snap.docs.map(async (d) => {
        const b = d.data();
        let routeName = "";
        if (b.routeId) { const r = await getDoc(doc(db, "routes", b.routeId)); if (r.exists()) routeName = r.data().name; }
        return { id: d.id, plateNumber: b.plateNumber, routeName, capacity: (b.capacity as number) ?? 14 };
      }));
      setBuses(rows);
      if (rows[0] && !busId) setBusId(rows[0].id);
    });
    return unsub;
  }, [isConductor]);

  useEffect(() => {
    if (!isConductor || !busId) return;
    const q = query(collection(db, "tickets"), where("busId", "==", busId));
    const unsub = onSnapshot(q, async (snap) => {
      const rows = await Promise.all(snap.docs.map(async (d) => {
        const t = { id: d.id, ...d.data() } as Record<string, unknown> & { id: string };
        let fullName = "", studentId = "";
        if (t.userId) { const u = await getDoc(doc(db, "users", t.userId as string)); if (u.exists()) { fullName = u.data().fullName ?? ""; studentId = u.data().studentId ?? ""; } }
        return { id: t.id, ticketCode: t.ticketCode as string, status: t.status as string, seatNumber: (t.seatNumber as number | null) ?? null, queuePosition: (t.queuePosition as number) ?? 0, pickupType: (t.pickupType as string) ?? "terminal", paymentMethod: (t.paymentMethod as string) ?? "cash", paymentStatus: (t.paymentStatus as string) ?? "pending", userId: t.userId as string, fullName, studentId } satisfies Manifest;
      }));
      rows.sort((a, b) => a.queuePosition - b.queuePosition);
      setManifest(rows);
      manifestRef.current = rows;
    });
    return unsub;
  }, [isConductor, busId]);

  const setStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, "tickets", id), { status });
    // When a passenger arrives (completed), free the seat by decrementing
    // the bus counter so the booking page reflects the available seat.
    if (status === "completed") {
      const ticketSnap = await getDoc(doc(db, "tickets", id));
      if (ticketSnap.exists()) {
        const busId = ticketSnap.data().busId as string;
        try {
          const busRef = doc(db, "buses", busId);
          const busSnap = await getDoc(busRef);
          if (busSnap.exists()) {
            const current = (busSnap.data().activeTicketCount as number) ?? 1;
            await updateDoc(busRef, { activeTicketCount: Math.max(0, current - 1) });
          }
        } catch { /* ignore counter update failure */ }
      }
    }
    toast.success(`Marked ${status}`);
  };

  const handleVerifyPayment = async (ticketId: string) => {
    if (!user) return;
    const res = await verifyPayment({ ticketId, conductorId: user.uid });
    if (!res.ok) toast.error(res.error); else toast.success("Payment verified — ticket confirmed");
  };

  const parseQrCode = (raw: string): string => {
    try { return (JSON.parse(raw).code ?? raw).toString().trim().toUpperCase(); }
    catch { return raw.trim().toUpperCase(); }
  };

  const boardByCode = async (rawCode: string) => {
    const code = parseQrCode(rawCode);
    // Use the ref so we always have the latest manifest even inside the scanner callback
    const current = manifestRef.current;
    const t = current.find((m) => m.ticketCode.toUpperCase() === code);
    if (!t) { toast.error(`Ticket "${code}" not found on this bus.`); return; }
    if (t.status === "boarded" || t.status === "completed") { toast.info("Already boarded."); return; }
    if (t.status === "cancelled") { toast.error("Ticket was cancelled."); return; }
    await setStatus(t.id, "boarded");
    toast.success(`Boarded: ${t.fullName || code}`);
  };

  const scanManual = async () => { const c = scanCode.trim(); if (!c) return; await boardByCode(c); setScanCode(""); };

  if (loading) return <div className="min-h-screen bg-background"><AppNav /></div>;

  if (!isConductor) {
    return (
      <div className="min-h-screen bg-background"><AppNav />
        <main className="container mx-auto max-w-xl px-4 py-20 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-bold">Conductor access required</h1>
          <p className="mt-2 text-muted-foreground">Signed in as <strong>{user?.email}</strong>. Roles: {roles.join(", ") || "student"}.</p>
          <Button className="mt-6" onClick={grantConductor} disabled={granting}>{granting ? "..." : "Request conductor access (demo)"}</Button>
        </main>
      </div>
    );
  }

  const counts = manifest.reduce((a, m) => { a[m.status] = (a[m.status] ?? 0) + 1; return a; }, {} as Record<string, number>);
  const pendingPayments = manifest.filter((t) => t.paymentStatus === "pending" && t.status !== "cancelled" && t.status !== "completed").length;
  const completedCount = counts.completed ?? 0;
  const selectedBus = buses.find((b) => b.id === busId);
  const capacity = selectedBus?.capacity ?? 14;

  return (
    <div className="min-h-screen bg-background"><AppNav />
      <main className="container mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold">Conductor console</h1>
        <p className="text-muted-foreground">Validate boarding, verify payments, manage manifest</p>
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground">Bus</label>
            <select value={busId} onChange={(e) => setBusId(e.target.value)} className="mt-1 rounded-lg border border-input bg-background px-3 py-2.5">
              {buses.map((b) => <option key={b.id} value={b.id}>{b.plateNumber} · {b.routeName}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs uppercase tracking-widest text-muted-foreground">Ticket code (manual)</label>
            <div className="mt-1 flex gap-2">
              <input value={scanCode} onChange={(e) => setScanCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && scanManual()} placeholder="e.g. A1B2C3D4" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono" />
              <Button onClick={scanManual} className="gap-2"><Search className="h-4 w-4" /> Board</Button>
            </div>
          </div>
        </div>
        <div className="mt-4"><p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Or scan student's QR code</p><QrScanner onScan={boardByCode} /></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-6">
          {[["Confirmed", counts.confirmed ?? 0, false], ["Boarded", counts.boarded ?? 0, false], ["Queued", counts.queued ?? 0, false], ["Completed", completedCount, false], ["Cancelled", counts.cancelled ?? 0, false], ["Pending payment", pendingPayments, pendingPayments > 0]].map(([label, value, warn]) => (
            <div key={label as string} className={`rounded-xl border bg-card p-4 ${warn ? "border-warning/40" : "border-border"}`}>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
              <div className="mt-1 flex items-center gap-2"><TicketIcon className={`h-4 w-4 ${warn ? "text-warning" : "text-primary"}`} /><span className={`font-display text-2xl font-bold ${warn ? "text-warning" : ""}`}>{value}</span></div>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Seat map</h2>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: capacity }, (_, i) => i + 1).map((seatNum) => {
              const ticket = manifest.find((t) => t.seatNumber === seatNum);
              const isBooked = ticket !== undefined;
              return (
                <div
                  key={seatNum}
                  title={isBooked ? `Seat ${seatNum} · ${ticket.fullName} · ${ticket.status}` : `Seat ${seatNum} · Available`}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                    isBooked
                      ? ticket.status === "completed"
                        ? "bg-slate-200 text-slate-600 border-2 border-slate-400"
                        : ticket.status === "boarded"
                          ? "bg-emerald-500 text-white border-2 border-emerald-600"
                          : ticket.status === "confirmed"
                            ? "bg-blue-500 text-white border-2 border-blue-600"
                            : ticket.status === "cancelled"
                              ? "bg-red-100 text-red-600 line-through border-2 border-red-300"
                              : "bg-secondary text-muted-foreground"
                      : "bg-white border-2 border-dashed border-slate-300 text-slate-400 hover:border-slate-400"
                  }`}
                >
                  {isBooked ? <User className="h-5 w-5" /> : seatNum}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><div className="h-5 w-5 rounded bg-white border-2 border-dashed border-slate-300 text-slate-400 flex items-center justify-center text-[10px]">1</div> Available</div>
            <div className="flex items-center gap-2"><div className="h-5 w-5 rounded bg-blue-500 border-2 border-blue-600 text-white flex items-center justify-center"><User className="h-3 w-3" /></div> Confirmed</div>
            <div className="flex items-center gap-2"><div className="h-5 w-5 rounded bg-emerald-500 border-2 border-emerald-600 text-white flex items-center justify-center"><User className="h-3 w-3" /></div> Boarded</div>
            <div className="flex items-center gap-2"><div className="h-5 w-5 rounded bg-slate-200 border-2 border-slate-400 text-slate-600 flex items-center justify-center"><User className="h-3 w-3" /></div> Completed</div>
            <div className="flex items-center gap-2"><div className="h-5 w-5 rounded bg-red-100 border-2 border-red-300 text-red-600 line-through flex items-center justify-center"><User className="h-3 w-3" /></div> Cancelled</div>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface text-surface-foreground">
              <tr><th className="px-4 py-3 text-left font-semibold">#</th><th className="px-4 py-3 text-left font-semibold">Passenger</th><th className="px-4 py-3 text-left font-semibold">Code</th><th className="px-4 py-3 text-left font-semibold">Seat</th><th className="px-4 py-3 text-left font-semibold">Boarding</th><th className="px-4 py-3 text-left font-semibold">Payment</th><th className="px-4 py-3 text-left font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr>
            </thead>
            <tbody>
              {manifest.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-surface/50">
                  <td className="px-4 py-3 font-mono">{t.queuePosition}</td>
                  <td className="px-4 py-3"><div className="font-medium">{t.fullName || "—"}</div>{t.studentId && <div className="text-xs text-muted-foreground">{t.studentId}</div>}</td>
                  <td className="px-4 py-3 font-mono">{t.ticketCode}</td>
                  <td className="px-4 py-3">{t.seatNumber ?? "—"}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs">{t.pickupType === "highway" ? <><Navigation className="h-3 w-3" /> Highway</> : <><Building2 className="h-3 w-3" /> Terminal</>}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1 text-xs">{t.paymentMethod === "gcash" ? <><Smartphone className="h-3 w-3" /> GCash</> : <><Banknote className="h-3 w-3" /> Cash</>}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${t.paymentStatus === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning-foreground"}`}>{t.paymentStatus === "paid" ? "✓ Paid" : "Pending"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${{ queued: "bg-amber-500/15 text-amber", confirmed: "bg-primary/15 text-primary", boarded: "bg-emerald-500/15 text-emerald-400", cancelled: "bg-destructive/15 text-destructive", completed: "bg-secondary text-foreground/70" }[t.status] ?? ""}`}>{t.status}</span></td>
                  <td className="px-4 py-3"><div className="flex flex-wrap justify-end gap-1">
                    {t.paymentStatus === "pending" && t.status !== "cancelled" && t.status !== "completed" && <Button size="sm" variant="outline" className="gap-1 text-success border-success/30 hover:bg-success/10" onClick={() => handleVerifyPayment(t.id)}><CheckCircle2 className="h-3 w-3" /> Verify</Button>}
                    {t.status !== "boarded" && t.status !== "cancelled" && t.status !== "completed" && <Button size="sm" variant="secondary" className="gap-1" onClick={() => setStatus(t.id, "boarded")}><CheckCircle2 className="h-4 w-4" /> Board</Button>}
                    {t.status === "boarded" && <span className="text-xs text-muted-foreground italic px-1">Student ends trip</span>}
                    {t.status !== "cancelled" && t.status !== "completed" && <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => setStatus(t.id, "cancelled")}><XCircle className="h-4 w-4" /> No-show</Button>}
                  </div></td>
                </tr>
              ))}
              {manifest.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-6 w-6" /> No tickets on this bus.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
