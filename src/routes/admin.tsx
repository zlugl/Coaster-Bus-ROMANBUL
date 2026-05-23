import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  collection, onSnapshot, doc, updateDoc, getDoc,
  setDoc, getDocs, query, where,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { db, firebaseAuth, secondaryFirebaseAuth } from "@/integrations/firebase";
import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/hooks/use-auth";
import {
  Bus, Users, ListOrdered, Activity, Shield,
  Smartphone, Save, UserPlus, Trash2, UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Operations · CoasterBusForU" }] }),
});

type Tab = "fleet" | "routes" | "staff";

type BusOps = {
  id: string; plateNumber: string; capacity: number; status: string;
  etaMinutes: number; routeId: string; routeName: string; fare: number;
  filled: number; queue: number;
  gcashNumber: string; driverId: string | null; conductorId: string | null;
};

type StaffMember = {
  uid: string; email: string; fullName: string;
  roles: string[]; assignedBus?: string;
};

type RouteRow = {
  id: string; name: string; origin: string; destination: string; fare: number;
};

// ── Admin page ────────────────────────────────────────────────────────────────
function AdminPage() {
  const { user, loading, isAdmin, roles } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("fleet");
  const [buses, setBuses] = useState<BusOps[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [routeFareEdits, setRouteFareEdits] = useState<Record<string, string>>({});
  const [savingRouteFare, setSavingRouteFare] = useState<string | null>(null);
  const [gcashEdits, setGcashEdits] = useState<Record<string, string>>({});
  const [savingGcash, setSavingGcash] = useState<string | null>(null);
  const [fareEdits, setFareEdits] = useState<Record<string, string>>({});
  const [savingFare, setSavingFare] = useState<string | null>(null);
  const [grantingSelf, setGrantingSelf] = useState(false);

  // New staff form
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"driver" | "conductor">("driver");
  const [creatingStaff, setCreatingStaff] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  // ── Fleet listener ──
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(collection(db, "buses"), async (snap) => {
      const rows = await Promise.all(snap.docs.map(async (d) => {
        const b = { id: d.id, ...d.data() } as Record<string, unknown> & { id: string };
        let routeName = "";
        let routeId = (b.routeId as string) ?? "";
        let fare = 0;
        if (b.routeId) {
          const r = await getDoc(doc(db, "routes", b.routeId as string));
          if (r.exists()) { routeName = r.data().name; fare = r.data().fare ?? 0; }
        }
        const tSnap = await getDocs(
          query(collection(db, "tickets"), where("busId", "==", b.id),
            where("status", "in", ["queued", "confirmed", "boarded"])),
        );
        const total = tSnap.size;
        const cap = (b.capacity as number) ?? 14;
        const gcashSnap = await getDoc(doc(db, "busGcash", b.id));
        const gcashNumber = gcashSnap.exists() ? (gcashSnap.data().gcashNumber ?? "") : "";
        return {
          id: b.id,
          plateNumber: b.plateNumber as string,
          capacity: cap,
          status: (b.status as string) ?? "idle",
          etaMinutes: (b.etaMinutes as number) ?? 0,
          routeId,
          routeName,
          fare,
          filled: Math.min(total, cap),
          queue: Math.max(0, total - cap),
          gcashNumber,
          driverId: (b.driverId as string | null) ?? null,
          conductorId: (b.conductorId as string | null) ?? null,
        } satisfies BusOps;
      }));
      setBuses(rows);
      setGcashEdits((prev) => {
        const n = { ...prev };
        rows.forEach((b) => { if (!(b.id in n)) n[b.id] = b.gcashNumber; });
        return n;
      });
      setFareEdits((prev) => {
        const n = { ...prev };
        rows.forEach((b) => { if (!(b.id in n)) n[b.id] = String(b.fare); });
        return n;
      });
    });
    return unsub;
  }, [isAdmin]);

  // ── Staff listener ──
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(
      query(collection(db, "users"),
        where("roles", "array-contains-any", ["driver", "conductor"])),
      (snap) => {
        const members: StaffMember[] = snap.docs.map((d) => ({
          uid: d.id,
          email: d.data().email ?? "",
          fullName: d.data().fullName ?? "",
          roles: d.data().roles ?? [],
        }));
        setStaff(members);
      },
    );
    return unsub;
  }, [isAdmin]);

  // ── Routes listener ──
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(collection(db, "routes"), (snap) => {
      const rows: RouteRow[] = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name ?? "",
        origin: d.data().origin ?? "",
        destination: d.data().destination ?? "",
        fare: d.data().fare ?? 0,
      }));
      rows.sort((a, b) => a.name.localeCompare(b.name));
      setRoutes(rows);
      setRouteFareEdits((prev) => {
        const n = { ...prev };
        rows.forEach((r) => { if (!(r.id in n)) n[r.id] = String(r.fare); });
        return n;
      });
    });
    return unsub;
  }, [isAdmin]);

  // ── Fleet actions ──
  const updateBus = async (id: string, patch: Record<string, unknown>) => {
    await updateDoc(doc(db, "buses", id), patch);
  };

  const saveGcash = async (busId: string) => {
    const number = (gcashEdits[busId] ?? "").trim();
    setSavingGcash(busId);
    await setDoc(doc(db, "busGcash", busId),
      { gcashNumber: number, updatedAt: new Date().toISOString() },
      { merge: true });
    setSavingGcash(null);
    toast.success("GCash number saved.");
  };

  const saveFare = async (busId: string) => {
    const bus = buses.find((b) => b.id === busId);
    if (!bus?.routeId) { toast.error("Bus has no linked route."); return; }
    const parsed = parseFloat(fareEdits[busId] ?? "");
    if (isNaN(parsed) || parsed < 0) { toast.error("Enter a valid fare amount."); return; }
    setSavingFare(busId);
    await updateDoc(doc(db, "routes", bus.routeId), { fare: parsed });
    setSavingFare(null);
    toast.success(`Fare updated to ₱${parsed.toFixed(2)}.`);
  };

  const saveRouteFare = async (routeId: string) => {
    const parsed = parseFloat(routeFareEdits[routeId] ?? "");
    if (isNaN(parsed) || parsed < 0) { toast.error("Enter a valid fare amount."); return; }
    setSavingRouteFare(routeId);
    await updateDoc(doc(db, "routes", routeId), { fare: parsed });
    setSavingRouteFare(null);
    toast.success("Fare updated.");
  };

  // Assign driver or conductor to a bus
  const assignToBus = async (
    busId: string,
    uid: string | null,
    field: "driverId" | "conductorId",
  ) => {
    await updateDoc(doc(db, "buses", busId), { [field]: uid });
    toast.success(uid ? "Assigned." : "Unassigned.");
  };

  // ── Staff actions ──
  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newName) return;
    setCreatingStaff(true);
    try {
      // Use the SECONDARY auth instance so the admin's own session is
      // never touched. createUserWithEmailAndPassword on the primary
      // instance would sign the admin out and sign in as the new user.
      const cred = await createUserWithEmailAndPassword(
        secondaryFirebaseAuth, newEmail, newPassword,
      );
      const newUid = cred.user.uid;

      // Immediately sign out of the secondary instance — we don't need
      // that session; we only needed the UID.
      await fbSignOut(secondaryFirebaseAuth);

      // Write Firestore profile using the primary (admin) db connection
      await setDoc(doc(db, "users", newUid), {
        email: newEmail,
        fullName: newName,
        studentId: "",
        phone: "",
        roles: [newRole],
        createdAt: new Date().toISOString(),
      });

      toast.success(`${newRole} account created for ${newEmail}`);
      setNewEmail(""); setNewPassword(""); setNewName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setCreatingStaff(false);
    }
  };

  const removeRole = async (uid: string, role: string) => {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    const current: string[] = snap.data()?.roles ?? [];
    const updated = current.filter((r) => r !== role);
    await updateDoc(ref, { roles: updated.length ? updated : ["student"] });
    // Unassign from any bus
    const busSnap = await getDocs(collection(db, "buses"));
    for (const b of busSnap.docs) {
      const data = b.data();
      if (data.driverId === uid) await updateDoc(b.ref, { driverId: null });
      if (data.conductorId === uid) await updateDoc(b.ref, { conductorId: null });
    }
    toast.success("Role removed.");
  };

  const grantSelfAdmin = async () => {
    if (!user) return;
    setGrantingSelf(true);
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const existing: string[] = snap.data()?.roles ?? ["student"];
    if (!existing.includes("admin")) await updateDoc(ref, { roles: [...existing, "admin"] });
    setGrantingSelf(false);
    toast.success("Admin granted. Reloading...");
    setTimeout(() => location.reload(), 600);
  };

  if (loading) return <div className="min-h-screen bg-background"><AppNav /></div>;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <main className="container mx-auto max-w-xl px-4 py-20 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-bold">Operations access required</h1>
          <p className="mt-2 text-muted-foreground">
            You're signed in as <strong>{user?.email}</strong>. Current roles: {roles.join(", ") || "student"}.
          </p>
          {import.meta.env.DEV && (
            <Button className="mt-6" onClick={grantSelfAdmin} disabled={grantingSelf}>
              {grantingSelf ? "..." : "Grant me admin (demo)"}
            </Button>
          )}
        </main>
      </div>
    );
  }

  const totalActive = buses.reduce((s, b) => s + b.filled + b.queue, 0);
  const totalQueue  = buses.reduce((s, b) => s + b.queue, 0);
  const capacity    = buses.reduce((s, b) => s + b.capacity, 0);

  const drivers    = staff.filter((s) => s.roles.includes("driver"));
  const conductors = staff.filter((s) => s.roles.includes("conductor"));

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="container mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-bold">Operations dashboard</h1>
        <p className="text-muted-foreground">Live monitoring · FIFO queue · staff management</p>

        {/* KPI cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {([
            ["Coasters", buses.length, <Bus key="b" />],
            ["Active tickets", totalActive, <Users key="u" />],
            ["In queue", totalQueue, <ListOrdered key="l" />],
            ["Total capacity", capacity, <Activity key="a" />],
          ] as [string, number, React.ReactNode][]).map(([label, value, icon]) => (
            <div key={label} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-accent">{icon}</span>
              </div>
              <div className="mt-2 font-display text-3xl font-bold">{value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mt-8 flex gap-1 rounded-xl border border-border bg-card p-1 w-fit">
          <button
            onClick={() => setTab("fleet")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition
              ${tab === "fleet" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Fleet & GCash
          </button>
          <button
            onClick={() => setTab("routes")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition
              ${tab === "routes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Routes
          </button>
          <button
            onClick={() => setTab("staff")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition
              ${tab === "staff" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Staff management
          </button>
        </div>

        {/* ── Fleet tab ── */}
        {tab === "fleet" && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-surface text-surface-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Bus</th>
                  <th className="px-4 py-3 text-left font-semibold">Route</th>
                  <th className="px-4 py-3 text-left font-semibold">Load</th>
                  <th className="px-4 py-3 text-left font-semibold">Queue</th>
                  <th className="px-4 py-3 text-left font-semibold">ETA</th>
                  <th className="px-4 py-3 text-left font-semibold">Fare (₱)</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Driver</th>
                  <th className="px-4 py-3 text-left font-semibold">Conductor</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    <span className="flex items-center gap-1">
                      <Smartphone className="h-3 w-3" /> GCash
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {buses.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono font-semibold">{b.plateNumber}</td>
                    {/* Route — dropdown lets admin reassign bus to any route */}
                    <td className="px-4 py-3">
                      <select
                        value={b.routeId}
                        onChange={(e) => updateBus(b.id, { routeId: e.target.value })}
                        className="rounded border border-input bg-background px-2 py-1 text-xs max-w-[160px]"
                      >
                        {routes.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full bg-primary" style={{ width: `${(b.filled / b.capacity) * 100}%` }} />
                        </div>
                        <span>{b.filled}/{b.capacity}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {b.queue > 0 ? <span className="font-semibold text-warning">+{b.queue}</span> : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        defaultValue={b.etaMinutes}
                        className="w-14 rounded border border-input bg-background px-2 py-1"
                        onBlur={(e) => updateBus(b.id, { etaMinutes: parseInt(e.target.value) || 0 })}
                      />{" min"}
                    </td>
                    {/* Fare */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">₱</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={fareEdits[b.id] ?? String(b.fare)}
                          onChange={(e) => setFareEdits((p) => ({ ...p, [b.id]: e.target.value }))}
                          className="w-20 rounded border border-input bg-background px-2 py-1 font-mono"
                        />
                        <Button
                          size="sm" variant="ghost" className="gap-1 px-2"
                          disabled={savingFare === b.id}
                          onClick={() => saveFare(b.id)}
                        >
                          <Save className="h-3 w-3" />
                          {savingFare === b.id ? "…" : ""}
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={b.status}
                        onChange={(e) => updateBus(b.id, { status: e.target.value })}
                        className="rounded border border-input bg-background px-2 py-1"
                      >
                        <option value="idle">idle</option>
                        <option value="boarding">boarding</option>
                        <option value="in_transit">in_transit</option>
                        <option value="arrived">arrived</option>
                      </select>
                    </td>
                    {/* Driver assign */}
                    <td className="px-4 py-3">
                      <select
                        value={b.driverId ?? ""}
                        onChange={(e) => assignToBus(b.id, e.target.value || null, "driverId")}
                        className="rounded border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="">— unassigned —</option>
                        {drivers.map((d) => (
                          <option key={d.uid} value={d.uid}>{d.fullName || d.email}</option>
                        ))}
                      </select>
                    </td>
                    {/* Conductor assign */}
                    <td className="px-4 py-3">
                      <select
                        value={b.conductorId ?? ""}
                        onChange={(e) => assignToBus(b.id, e.target.value || null, "conductorId")}
                        className="rounded border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="">— unassigned —</option>
                        {conductors.map((c) => (
                          <option key={c.uid} value={c.uid}>{c.fullName || c.email}</option>
                        ))}
                      </select>
                    </td>
                    {/* GCash */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={gcashEdits[b.id] ?? b.gcashNumber}
                          onChange={(e) => setGcashEdits((p) => ({ ...p, [b.id]: e.target.value }))}
                          placeholder="09XXXXXXXXX"
                          className="w-32 rounded border border-input bg-background px-2 py-1 font-mono text-sm"
                          maxLength={15}
                        />
                        <Button
                          size="sm" variant="ghost" className="gap-1"
                          disabled={savingGcash === b.id}
                          onClick={() => saveGcash(b.id)}
                        >
                          <Save className="h-3 w-3" />
                          {savingGcash === b.id ? "…" : "Save"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Routes tab ── */}
        {tab === "routes" && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-surface text-surface-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Route</th>
                  <th className="px-4 py-3 text-left font-semibold">From</th>
                  <th className="px-4 py-3 text-left font-semibold">To</th>
                  <th className="px-4 py-3 text-left font-semibold">Fare (₱)</th>
                  <th className="px-4 py-3 text-left font-semibold">Buses assigned</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => {
                  const assignedBuses = buses.filter((b) => b.routeId === r.id);
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-3 font-semibold">{r.name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{r.origin}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{r.destination}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">₱</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={routeFareEdits[r.id] ?? String(r.fare)}
                            onChange={(e) => setRouteFareEdits((p) => ({ ...p, [r.id]: e.target.value }))}
                            className="w-20 rounded border border-input bg-background px-2 py-1 font-mono"
                          />
                          <Button
                            size="sm" variant="ghost" className="gap-1 px-2"
                            disabled={savingRouteFare === r.id}
                            onClick={() => saveRouteFare(r.id)}
                          >
                            <Save className="h-3 w-3" />
                            {savingRouteFare === r.id ? "…" : "Save"}
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {assignedBuses.length === 0 ? (
                          <span className="text-xs text-muted-foreground">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {assignedBuses.map((b) => (
                              <span key={b.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-mono font-semibold text-primary">
                                {b.plateNumber}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {routes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No routes yet. Run the seed script to populate routes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Staff tab ── */}
        {tab === "staff" && (
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_2fr]">

            {/* Create new staff account */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <UserPlus className="h-5 w-5 text-primary" /> Add staff account
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Creates a Firebase Auth account + assigns the role.
              </p>
              <form onSubmit={createStaff} className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="sname">Full name</Label>
                  <Input
                    id="sname" value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required maxLength={80}
                  />
                </div>
                <div>
                  <Label htmlFor="semail">Email</Label>
                  <Input
                    id="semail" type="email" value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="spass">Password</Label>
                  <Input
                    id="spass" type="password" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required minLength={6}
                  />
                </div>
                <div>
                  <Label htmlFor="srole">Role</Label>
                  <select
                    id="srole"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as "driver" | "conductor")}
                    className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="driver">Driver</option>
                    <option value="conductor">Conductor</option>
                  </select>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={creatingStaff}>
                  <UserPlus className="h-4 w-4" />
                  {creatingStaff ? "Creating…" : "Create account"}
                </Button>
              </form>
            </div>

            {/* Staff list */}
            <div className="space-y-4">
              {/* Drivers */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 bg-surface px-5 py-3 text-surface-foreground">
                  <Bus className="h-4 w-4 text-amber" />
                  <span className="font-semibold">Drivers ({drivers.length})</span>
                </div>
                {drivers.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-muted-foreground">No drivers yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/30">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Email</th>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Assigned bus</th>
                        <th className="px-4 py-2 text-right font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.map((d) => {
                        const assignedBus = buses.find((b) => b.driverId === d.uid);
                        return (
                          <tr key={d.uid} className="border-t border-border">
                            <td className="px-4 py-3 font-medium">{d.fullName || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{d.email}</td>
                            <td className="px-4 py-3">
                              {assignedBus
                                ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">{assignedBus.plateNumber}</span>
                                : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm" variant="ghost"
                                className="gap-1 text-destructive hover:text-destructive"
                                onClick={() => removeRole(d.uid, "driver")}
                              >
                                <Trash2 className="h-3 w-3" /> Remove
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Conductors */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 bg-surface px-5 py-3 text-surface-foreground">
                  <UserCheck className="h-4 w-4 text-amber" />
                  <span className="font-semibold">Conductors ({conductors.length})</span>
                </div>
                {conductors.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-muted-foreground">No conductors yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/30">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Email</th>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Assigned bus</th>
                        <th className="px-4 py-2 text-right font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conductors.map((c) => {
                        const assignedBus = buses.find((b) => b.conductorId === c.uid);
                        return (
                          <tr key={c.uid} className="border-t border-border">
                            <td className="px-4 py-3 font-medium">{c.fullName || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                            <td className="px-4 py-3">
                              {assignedBus
                                ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">{assignedBus.plateNumber}</span>
                                : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm" variant="ghost"
                                className="gap-1 text-destructive hover:text-destructive"
                                onClick={() => removeRole(c.uid, "conductor")}
                              >
                                <Trash2 className="h-3 w-3" /> Remove
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
