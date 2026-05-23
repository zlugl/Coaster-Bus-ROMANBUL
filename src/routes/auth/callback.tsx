import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "@/integrations/firebase";
import { Bus } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
  head: () => ({ meta: [{ title: "Signing in… · CoasterBusForU" }] }),
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        unsub();
        navigate({ to: "/book", replace: true });
      }
    });
    const timeout = setTimeout(() => navigate({ to: "/login", replace: true }), 5_000);
    return () => { unsub(); clearTimeout(timeout); };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface bg-grid p-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <Bus className="h-7 w-7" />
      </div>
      <svg className="h-8 w-8 animate-spin text-amber" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p className="text-sm text-surface-foreground/70">Completing sign-in…</p>
    </div>
  );
}
