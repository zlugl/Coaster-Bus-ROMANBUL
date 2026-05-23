import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/integrations/firebase";
import { Bus, Ticket, MapPin, Bell, ListOrdered, Activity, ArrowRight } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "CoasterBusForU — AI Ticketing for Student Transport in Romanbul" },
      { name: "description", content: "FIFO-queue AI ticketing system for student coaster bus transport in Romanbul. Digital tickets, auto seat assignment, live tracking, ETA alerts." },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <section className="relative overflow-hidden bg-surface text-surface-foreground">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="container relative mx-auto grid gap-10 px-4 py-14 sm:py-20 md:grid-cols-2 md:gap-12 md:py-28">
          <div className="animate-fade-in-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber">
              <Activity className="h-3 w-3 animate-pulse" /> Live · FIFO Queue 2026
            </span>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Student transport,<br />
              <span className="text-amber">queue-fair</span> and on time.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-surface-foreground/70">
              CoasterBusForU is the AI ticketing system for Romanbul students. Book a seat, get a queue number, watch your coaster in real time, and arrive with the ETA you trust.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to="/book" className="w-full sm:w-auto">
                <Button size="lg" className="btn-press w-full bg-accent text-accent-foreground shadow-lg shadow-amber/20 hover:bg-accent/90 sm:w-auto">
                  Book a seat <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="btn-press w-full border-surface-foreground/20 bg-transparent text-surface-foreground hover:bg-surface-foreground/10 sm:w-auto">
                  Student sign in
                </Button>
              </Link>
            </div>
            <LiveStats />
          </div>
          <div className="relative animate-fade-in-up stagger-2 md:block">
            <div className="absolute -inset-6 rounded-3xl bg-accent/10 blur-2xl" />
            <div className="relative rounded-2xl border border-surface-foreground/10 bg-surface-foreground/5 p-4 backdrop-blur transition-transform duration-500 hover:scale-[1.01] sm:p-6">
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-amber">CBR-101 · R1 Campus Loop</span>
                <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-semibold text-success">BOARDING</span>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-2">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className={`aspect-square rounded ${i < 9 ? "bg-accent" : "bg-surface-foreground/10"}`} />
                ))}
              </div>
              <div className="mt-4 flex justify-between text-xs text-surface-foreground/60">
                <span>9 / 14 seats</span><span>ETA 5 min</span>
              </div>
              <div className="mt-6 space-y-2">
                {[
                  { code: "A4F2K9", name: "You", pos: 9 },
                  { code: "B1X7M3", name: "Queue +1", pos: 10 },
                  { code: "C9P2L8", name: "Queue +2", pos: 11 },
                ].map((t) => (
                  <div key={t.code} className="flex items-center justify-between rounded-md bg-surface-foreground/5 px-3 py-2 text-sm">
                    <span className="font-mono text-amber">{t.code}</span>
                    <span className="text-surface-foreground/70">{t.name}</span>
                    <span className="font-mono">#{t.pos}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <h2 className="font-display text-3xl font-bold md:text-4xl">Everything a student commuter needs</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">Built for fairness, speed, and transparency — powered by a deterministic FIFO queue.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: <Ticket />, title: "Digital Ticketing", desc: "Tap to book. Get a unique code, QR-ready, no paper." },
            { icon: <ListOrdered />, title: "FIFO Queue", desc: "First in, first served. Position assigned the moment you tap." },
            { icon: <Bus />, title: "Auto Seat Assignment", desc: "Seats #1–#14 fill in order. Overflow auto-queues for the next coaster." },
            { icon: <MapPin />, title: "Real-Time Tracking", desc: "Watch every coaster move live on the route." },
            { icon: <Bell />, title: "ETA Notifications", desc: "Smart alerts as your bus approaches the stop." },
            { icon: <Activity />, title: "Operations Monitoring", desc: "Operators see queue length, loads, and ETAs at a glance." },
          ].map((f, i) => (
            <Feature key={f.title} {...f} className={["stagger-1", "stagger-2", "stagger-3", "stagger-4", "stagger-1", "stagger-2"][i]} />
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © 2026 CoasterBusForU · Romanbul Student Transport
      </footer>
    </div>
  );
}

function LiveStats() {
  const [routeCount, setRouteCount] = useState<string>("—");
  const [busCount, setBusCount] = useState<string>("—");
  const [avgEta, setAvgEta] = useState<string>("—");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "buses"),
      (snap) => {
        const buses = snap.docs.map((d) => d.data());
        const routes = new Set(
          buses.map((b) => b.routeId as string | undefined).filter(Boolean),
        );
        const active = buses.filter((b) => b.status && b.status !== "idle");
        const etas = buses
          .map((b) => (b.etaMinutes as number) ?? 0)
          .filter((e) => e > 0);
        setRouteCount(String(routes.size));
        setBusCount(String(active.length > 0 ? active.length : buses.length));
        setAvgEta(
          etas.length > 0
            ? `${Math.round(etas.reduce((a, b) => a + b, 0) / etas.length)} min`
            : "—",
        );
      },
      () => {
        setRouteCount("—");
        setBusCount("—");
        setAvgEta("—");
      },
    );
    return unsub;
  }, []);

  return (
    <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-surface-foreground/10 pt-8">
      <Stat label="Active routes" value={routeCount} />
      <Stat label="Coasters online" value={busCount} />
      <Stat label="Avg ETA" value={avgEta} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-surface-foreground/50">{label}</dt>
      <dd className="mt-1 font-display text-3xl font-bold text-amber">{value}</dd>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group card-interactive animate-fade-in-up rounded-xl border border-border bg-card p-5 sm:p-6 hover:border-accent",
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition duration-300 group-hover:scale-110 group-hover:bg-accent group-hover:text-accent-foreground">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
