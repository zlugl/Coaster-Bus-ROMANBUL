import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/integrations/firebase";
import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, CheckCircle2, AlertCircle, Bus, ClipboardCheck, MapPin, LocateFixed, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  validateSearch: (search: Record<string, unknown>) => ({
    onboarding: search.onboarding === "1" || search.onboarding === true,
  }),
  component: ProfilePage,
  head: () => ({ meta: [{ title: "My Profile · CoasterBusForU" }] }),
});

type ProfileData = {
  fullName: string;
  studentId: string;
  phone: string;
  pickupLat: number | null;
  pickupLng: number | null;
};

type AssignedBus = {
  plateNumber: string;
  routeName: string;
  status: string;
} | null;

// ── Student profile ───────────────────────────────────────────────────────────
function StudentProfile({
  user,
  profile,
  setProfile,
  originalProfile,
  saving,
  onSave,
  isComplete,
  showOnboarding,
}: {
  user: { email: string | null };
  profile: ProfileData;
  setProfile: React.Dispatch<React.SetStateAction<ProfileData>>;
  originalProfile: ProfileData;
  saving: boolean;
  onSave: (e: React.FormEvent) => void;
  isComplete: boolean;
  showOnboarding?: boolean;
}) {
  const [locating, setLocating] = useState(false);

  const isDirty =
    profile.fullName !== originalProfile.fullName ||
    profile.studentId !== originalProfile.studentId ||
    profile.phone !== originalProfile.phone ||
    profile.pickupLat !== originalProfile.pickupLat ||
    profile.pickupLng !== originalProfile.pickupLng;

  const detectLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProfile((p) => ({
          ...p,
          pickupLat: pos.coords.latitude,
          pickupLng: pos.coords.longitude,
        }));
        setLocating(false);
        toast.success("Pickup location detected. Save your profile to keep it.");
      },
      (err) => {
        setLocating(false);
        toast.error(`Could not get location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [setProfile]);

  return (
    <>
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UserCircle className="h-8 w-8" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">
            Your name and student ID appear on your ticket QR code for conductor verification.
          </p>
        </div>
      </div>

      {showOnboarding && (
        <div className="mt-6 rounded-xl border border-accent/30 bg-accent/10 p-5">
          <p className="font-display text-lg font-semibold text-accent-foreground">Welcome to CoasterBusForU</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete these steps, then book your first seat.
          </p>
          <ol className="mt-4 space-y-2 text-sm">
            <li className={`flex items-center gap-2 ${isComplete ? "text-success" : ""}`}>
              {isComplete ? <CheckCircle2 className="h-4 w-4" /> : <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>}
              Name & student ID
            </li>
            <li className={`flex items-center gap-2 ${profile.pickupLat != null ? "text-success" : "text-muted-foreground"}`}>
              {profile.pickupLat != null ? <CheckCircle2 className="h-4 w-4" /> : <span className="flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] font-bold">2</span>}
              Highway pickup location (optional)
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] font-bold">3</span>
              Book a seat
            </li>
          </ol>
          {isComplete && (
            <Link to="/book" className="mt-4 inline-flex">
              <Button className="gap-2">
                Book a seat <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      )}

      {!isComplete && !showOnboarding && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="font-semibold text-warning-foreground">Profile incomplete</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Fill in your full name and student ID before booking a ticket.
              The conductor uses this to verify your identity when boarding.
            </p>
          </div>
        </div>
      )}

      {isComplete && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <p className="text-sm font-medium text-success">Profile complete — ready to book</p>
        </div>
      )}

      <form onSubmit={onSave} className="mt-6 space-y-5">
        <div>
          <Label htmlFor="fullName">
            Full name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="fullName"
            value={profile.fullName}
            onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
            placeholder="e.g. Juan dela Cruz"
            required maxLength={100} className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">Must match your school ID exactly.</p>
        </div>

        <div>
          <Label htmlFor="studentId">
            Student ID <span className="text-destructive">*</span>
          </Label>
          <Input
            id="studentId"
            value={profile.studentId}
            onChange={(e) => setProfile((p) => ({ ...p, studentId: e.target.value }))}
            placeholder="e.g. 2024-00123"
            required maxLength={50} className="mt-1 font-mono"
          />
          <p className="mt-1 text-xs text-muted-foreground">This is printed on your ticket QR code.</p>
        </div>

        <div>
          <Label htmlFor="phone">Phone number (optional)</Label>
          <Input
            id="phone"
            type="tel"
            value={profile.phone}
            onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
            placeholder="e.g. 09XXXXXXXXX"
            maxLength={15} className="mt-1"
          />
        </div>

        {/* Highway pickup location */}
        <div>
          <Label className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Highway pickup location (optional)
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Save your location so the bus can alert you when it's approaching your pickup point.
            Only used for highway pick-up tickets.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={detectLocation}
              disabled={locating}
            >
              <LocateFixed className="h-3.5 w-3.5" />
              {locating ? "Detecting…" : "Use my current location"}
            </Button>
            {profile.pickupLat != null && profile.pickupLng != null && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setProfile((p) => ({ ...p, pickupLat: null, pickupLng: null }))}
              >
                Clear
              </Button>
            )}
          </div>
          {profile.pickupLat != null && profile.pickupLng != null ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-success" />
              <span className="font-mono text-success">
                {profile.pickupLat.toFixed(5)}, {profile.pickupLng.toFixed(5)}
              </span>
              <span className="text-muted-foreground">— saved pickup point</span>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              No pickup location saved — proximity alerts won't be sent.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Account email</p>
          <p className="mt-1 font-medium">{user.email}</p>
        </div>

        <Button type="submit" className="w-full" disabled={saving || !isDirty}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>

      {isComplete && (
        <div className="mt-8 rounded-xl border border-border bg-card p-5">
          <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
            What the conductor sees on your ticket
          </p>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserCircle className="h-7 w-7" />
            </div>
            <div>
              <p className="font-semibold">{profile.fullName}</p>
              <p className="font-mono text-sm text-muted-foreground">ID: {profile.studentId}</p>
              {profile.phone && <p className="text-sm text-muted-foreground">{profile.phone}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Staff profile (conductor / driver) ────────────────────────────────────────
function StaffProfile({
  user,
  profile,
  setProfile,
  originalProfile,
  saving,
  onSave,
  role,
  assignedBus,
}: {
  user: { email: string | null };
  profile: ProfileData;
  setProfile: React.Dispatch<React.SetStateAction<ProfileData>>;
  originalProfile: ProfileData;
  saving: boolean;
  onSave: (e: React.FormEvent) => void;
  role: "conductor" | "driver";
  assignedBus: AssignedBus;
}) {
  const isDirty =
    profile.fullName !== originalProfile.fullName ||
    profile.phone !== originalProfile.phone;

  const Icon = role === "conductor" ? ClipboardCheck : Bus;
  const roleLabel = role === "conductor" ? "Conductor" : "Driver";

  return (
    <>
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-8 w-8" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">{roleLabel} Profile</h1>
          <p className="text-muted-foreground">
            Manage your display name and contact details.
          </p>
        </div>
      </div>

      {/* Assigned bus card */}
      <div className={`mt-6 rounded-xl border p-4 ${
        assignedBus
          ? "border-success/30 bg-success/10"
          : "border-border bg-card"
      }`}>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Assigned bus</p>
        {assignedBus ? (
          <div className="mt-2 flex items-center gap-3">
            <Bus className="h-5 w-5 text-success" />
            <div>
              <p className="font-mono font-bold">{assignedBus.plateNumber}</p>
              <p className="text-sm text-muted-foreground">{assignedBus.routeName}</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase
                ${{ boarding: "bg-success/15 text-success", in_transit: "bg-accent/20 text-accent-foreground", idle: "bg-muted text-muted-foreground", arrived: "bg-primary/10 text-primary" }[assignedBus.status] ?? "bg-muted text-muted-foreground"}`}>
                {assignedBus.status.replace("_", " ")}
              </span>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            No bus assigned yet. The admin will assign you a bus from the Operations dashboard.
          </p>
        )}
      </div>

      <form onSubmit={onSave} className="mt-6 space-y-5">
        <div>
          <Label htmlFor="fullName">
            Full name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="fullName"
            value={profile.fullName}
            onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
            placeholder="e.g. Juan dela Cruz"
            required maxLength={100} className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            type="tel"
            value={profile.phone}
            onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
            placeholder="e.g. 09XXXXXXXXX"
            maxLength={15} className="mt-1"
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Account email</p>
          <p className="mt-1 font-medium">{user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground capitalize">Role: {roleLabel}</p>
        </div>

        <Button type="submit" className="w-full" disabled={saving || !isDirty}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function ProfilePage() {
  const { user, loading, roles, isConductor, isDriver } = useAuth();
  const { onboarding: showOnboarding } = Route.useSearch();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData>({ fullName: "", studentId: "", phone: "", pickupLat: null, pickupLng: null });
  const [originalProfile, setOriginalProfile] = useState<ProfileData>({ fullName: "", studentId: "", phone: "", pickupLat: null, pickupLng: null });
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [assignedBus, setAssignedBus] = useState<AssignedBus>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Load profile
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const p: ProfileData = {
          fullName: data.fullName ?? "",
          studentId: data.studentId ?? "",
          phone: data.phone ?? "",
          pickupLat: (data.pickupLat as number | undefined) ?? null,
          pickupLng: (data.pickupLng as number | undefined) ?? null,
        };
        setProfile(p);
        setOriginalProfile(p);
        setIsComplete(!!p.fullName && !!p.studentId);
      }
      setFetching(false);
    });
  }, [user]);

  // Load assigned bus for staff
  useEffect(() => {
    if (!user || (!isConductor && !isDriver)) return;
    const field = isDriver ? "driverId" : "conductorId";
    getDocs(query(collection(db, "buses"), where(field, "==", user.uid))).then(async (snap) => {
      if (snap.empty) { setAssignedBus(null); return; }
      const b = snap.docs[0].data();
      let routeName = "";
      if (b.routeId) {
        const r = await getDoc(doc(db, "routes", b.routeId));
        if (r.exists()) routeName = r.data().name;
      }
      setAssignedBus({ plateNumber: b.plateNumber, routeName, status: b.status ?? "idle" });
    }).catch(() => setAssignedBus(null));
  }, [user, isConductor, isDriver]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!profile.fullName.trim()) { toast.error("Full name is required."); return; }
    // Student ID only required for students
    const isStudent = !isConductor && !isDriver && !roles.includes("admin");
    if (isStudent && !profile.studentId.trim()) { toast.error("Student ID is required."); return; }

    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          fullName: profile.fullName.trim(),
          studentId: profile.studentId.trim(),
          phone: profile.phone.trim(),
          pickupLat: profile.pickupLat ?? null,
          pickupLng: profile.pickupLng ?? null,
        },
        { merge: true },
      );
      setOriginalProfile({ ...profile });
      setIsComplete(!!profile.fullName && !!profile.studentId);
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <main className="container mx-auto max-w-lg px-4 py-10">
          <div className="space-y-4 animate-pulse">
            <div className="h-8 w-48 rounded bg-secondary" />
            <div className="h-4 w-64 rounded bg-secondary" />
            <div className="mt-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded bg-secondary" />)}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Determine which role view to show
  const staffRole = isConductor ? "conductor" : isDriver ? "driver" : null;

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="container mx-auto max-w-lg px-4 py-10">
        {staffRole ? (
          <StaffProfile
            user={{ email: user?.email ?? null }}
            profile={profile}
            setProfile={setProfile}
            originalProfile={originalProfile}
            saving={saving}
            onSave={handleSave}
            role={staffRole}
            assignedBus={assignedBus}
          />
        ) : (
          <StudentProfile
            user={{ email: user?.email ?? null }}
            profile={profile}
            setProfile={setProfile}
            originalProfile={originalProfile}
            saving={saving}
            onSave={handleSave}
            isComplete={isComplete}
            showOnboarding={showOnboarding}
          />
        )}
      </main>
    </div>
  );
}
