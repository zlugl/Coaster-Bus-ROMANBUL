import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { firebaseAuth, googleProvider, db } from "@/integrations/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatFirebaseAuthError } from "@/lib/ux";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in · CoasterBusForU" }] }),
});

/** Ensure a Firestore user profile + default role exists after sign-in. */
async function ensureUserDoc(uid: string, extra?: { fullName?: string; studentId?: string }) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      fullName: extra?.fullName ?? "",
      studentId: extra?.studentId ?? "",
      phone: "",
      roles: ["student"],
      createdAt: serverTimestamp(),
    });
  }
}

/**
 * Read the user's roles from Firestore and return the correct landing path.
 *   admin / operator → /admin
 *   driver           → /driver
 *   conductor        → /conductor
 *   student (default)→ /book
 */
async function getLandingPath(uid: string): Promise<string> {
  const snap = await getDoc(doc(db, "users", uid));
  const roles: string[] = snap.data()?.roles ?? ["student"];
  if (roles.includes("admin") || roles.includes("operator")) return "/admin";
  if (roles.includes("driver"))    return "/driver";
  if (roles.includes("conductor")) return "/conductor";
  return "/book";
}

function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  // ── Email / password ──────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        await ensureUserDoc(cred.user.uid, { fullName, studentId });
        toast.success("Account created! Complete your profile to start booking.");
        navigate({ to: "/profile", search: { onboarding: "1" } });
      } else {
        const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const path = await getLandingPath(cred.user.uid);
        navigate({ to: path as "/" });
      }
    } catch (err: unknown) {
      toast.error(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter your email above first.");
      return;
    }
    setLoading(true);
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      toast.success("Password reset email sent — check your inbox.");
    } catch (err: unknown) {
      toast.error(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Google ────────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      GoogleAuthProvider.credentialFromResult(result);
      await ensureUserDoc(result.user.uid, {
        fullName: result.user.displayName ?? "",
      });
      const path = await getLandingPath(result.user.uid);
      const profileSnap = await getDoc(doc(db, "users", result.user.uid));
      const pd = profileSnap.data();
      const needsProfile =
        path === "/book" && (!pd?.fullName?.trim() || !pd?.studentId?.trim());
      toast.success(`Welcome, ${result.user.displayName ?? result.user.email}!`);
      navigate({
        to: needsProfile ? "/profile" : (path as "/"),
        ...(needsProfile ? { search: { onboarding: "1" } } : {}),
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code !== "auth/popup-closed-by-user") {
        toast.error(formatFirebaseAuthError(err));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface bg-grid p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bus className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-lg font-bold">CoasterBus<span className="text-amber">ForU</span></div>
            <div className="text-xs text-muted-foreground">Romanbul · 2026</div>
          </div>
        </Link>

        <h1 className="font-display text-2xl font-bold">
          {mode === "signin" ? "Welcome back" : "Create student account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in to book your seat" : "Sign up to start booking"}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
              </div>
              <div>
                <Label htmlFor="sid">Student ID</Label>
                <Input id="sid" value={studentId} onChange={(e) => setStudentId(e.target.value)} required maxLength={50} />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === "signin" && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleForgotPassword}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogle} disabled={googleLoading}>
          {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          {googleLoading ? "Signing in…" : "Continue with Google"}
        </Button>

        <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground">
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
