import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/integrations/firebase";
import {
  Bus, Ticket, MapPin, Bell, ListOrdered, Activity,
  ArrowRight, Armchair, Navigation, Shield, Zap,
} from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "CoasterBusForU — AI Ticketing for Student Transport in Romanbul" },
      { name: "description", content: "FIFO-queue ticketing system for student coaster bus transport in Romanbul. Digital tickets, seat selection, live tracking, ETA alerts." },
    ],
  }),
});

// ── Animated seat grid for the hero card ─────────────────────────────────────
function AnimatedSeatGrid() {
  const [filled, setFilled] = useState(9);
  const [selected, setSelected] = useState<number | null>(null);
  const dir = useRef(1);

  // Slowly animate seats filling / emptying
  useEffect(() => {
    const id = setInterval(() => {
      setFilled((prev) => {
        const next = prev + dir.current;
        if (next >= 13) dir.current = -1;
        if (next <= 4) dir.current = 1;
        return next;
      });
    }, 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-4 grid grid-cols-7 gap-1.5">
      {Array.from({ length: 14 }, (_, i) => {
        const seatNum = i + 1;
        const isTaken = i < filled;
        const isSelected = selected === seatNum;
        return (
          <button
            key={i}
            onClick={() => !isTaken && setSelected(isSelected ? null : seatNum)}
            disabled={isTaken}
            className={cn(
              "aspect-square rounded-md text-[10px] font-bold transition-all duration-300",
              isTaken && "cursor-not-allowed bg-accent/70 text-accent-foreground scale-95",
              !isTaken && !isSelected && "bg-surface-foreground/10 hover:bg-accent/40 hover:scale-105 cursor-pointer",
              isSelected && "bg-accent text-accent-foreground scale-110 ring-2 ring-accent ring-offset-1 ring-offset-transparent",
            )}
          >
            {!isTaken && seatNum}
          </button>
        );
      })}
    </div>
  );
}

// ── Hero section ──────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative overflow-hidden text-surface-foreground">
      {/* Multi-layer gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#0f2847] to-[#1a3a5c]" />
      {/* Radial glow accents */}
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-amber/10 blur-3xl" />
      <div className="absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-2xl" />
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-grid opacity-30" />

      <div className="container relative mx-auto grid gap-10 px-4 py-16 sm:py-24 md:grid-cols-2 md:gap-16 md:py-32">
        {/* Left — copy */}
        <div className="animate-fade-in-up flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber/30 bg-amber/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber" />
            Live · FIFO Queue · Romanbul 2026
          </span>

          <div className="mt-6 flex items-center gap-4">
            <img
              src="/image/coasterBus-logo.png"
              alt="CoasterBusForU"
              className="h-16 w-16 rounded-2xl object-contain shadow-xl shadow-amber/30 ring-2 ring-amber/20 sm:h-20 sm:w-20 transition-transform duration-500 hover:scale-105 hover:rotate-2"
            />
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Student transport,{" "}
              <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                queue-fair
              </span>{" "}
              and on time.
            </h1>
          </div>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-surface-foreground/75">
            CoasterBusForU is the digital ticketing system for Romanbul students.
            Pick your seat, get your QR code, track your coaster live, and board
            with confidence.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link to="/book" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="btn-press group w-full gap-2 bg-gradient-to-r from-amber-400 to-yellow-300 font-semibold text-[#0f2847] shadow-lg shadow-amber/30 transition-all duration-300 hover:shadow-amber/50 hover:shadow-xl sm:w-auto"
              >
                Book a seat
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="btn-press w-full border-surface-foreground/25 bg-transparent text-surface-foreground backdrop-blur transition-all duration-300 hover:border-amber/50 hover:bg-surface-foreground/10 sm:w-auto"
              >
                Student sign in
              </Button>
            </Link>
          </div>

          <LiveStats />
        </div>

        {/* Right — interactive demo card */}
        <div className="animate-fade-in-up stagger-2 flex items-center justify-center">
          <div className="relative w-full max-w-sm">
            {/* Glow behind card */}
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-amber/20 to-blue-500/10 blur-2xl" />
            <div className="relative rounded-2xl border border-surface-foreground/15 bg-surface-foreground/5 p-5 shadow-2xl backdrop-blur-md transition-transform duration-500 hover:scale-[1.02] sm:p-6">
              {/* Card header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bus className="h-4 w-4 text-amber" />
                  <span className="font-mono text-sm font-semibold text-amber">CBF-001 · Mansalay → Roxas</span>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-success/20 px-2 py-0.5 text-xs font-semibold text-success">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                  BOARDING
                </span>
              </div>

              {/* Seat grid — interactive */}
              <div className="mt-3 text-[10px] uppercase tracking-widest text-surface-foreground/40">
                Tap an open seat to select it
              </div>
              <AnimatedSeatGrid />

              <div className="mt-3 flex items-center justify-between text-xs text-surface-foreground/50">
                <span className="flex items-center gap-1">
                  <Armchair className="h-3 w-3" /> 5 seats open
                </span>
                <span>ETA 5 min</span>
              </div>

              {/* Divider */}
              <div className="my-4 h-px bg-surface-foreground/10" />

              {/* Ticket rows */}
              <div className="space-y-2">
                {[
                  { code: "A4F2K9", name: "You", seat: 9, paid: true },
                  { code: "B1X7M3", name: "Maria S.", seat: 10, paid: true },
                  { code: "C9P2L8", name: "Juan D.", seat: 11, paid: false },
                ].map((t) => (
                  <div
                    key={t.code}
                    className="flex items-center justify-between rounded-lg bg-surface-foreground/5 px-3 py-2 text-xs transition-colors duration-200 hover:bg-surface-foreground/10"
                  >
                    <span className="font-mono font-semibold text-amber">{t.code}</span>
                    <span className="text-surface-foreground/70">{t.name}</span>
                    <span className="font-mono text-surface-foreground/60">Seat #{t.seat}</span>
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      t.paid ? "bg-success/20 text-success" : "bg-warning/20 text-warning-foreground",
                    )}>
                      {t.paid ? "Paid" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Fare badge */}
              <div className="mt-4 flex items-center justify-between rounded-lg border border-amber/20 bg-amber/5 px-3 py-2">
                <span className="text-xs text-surface-foreground/60">Fare</span>
                <span className="font-display text-lg font-bold text-amber">₱60.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── How it works section ──────────────────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    {
      num: "01",
      icon: <Ticket className="h-6 w-6" />,
      title: "Book your seat",
      desc: "Choose your route, pick your preferred seat, select cash or GCash — done in under a minute.",
    },
    {
      num: "02",
      icon: <Armchair className="h-6 w-6" />,
      title: "Get your QR ticket",
      desc: "Your digital ticket with a unique QR code is ready instantly. No paper, no queuing at a counter.",
    },
    {
      num: "03",
      icon: <Navigation className="h-6 w-6" />,
      title: "Track your coaster",
      desc: "Watch your bus move live on the map. Get notified when it's approaching your pickup point.",
    },
    {
      num: "04",
      icon: <Shield className="h-6 w-6" />,
      title: "Board with confidence",
      desc: "Show your QR code to the conductor. They scan it, verify your payment, and you're on.",
    },
  ];

  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/30 to-background" />
      <div className="container relative mx-auto px-4">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            <Zap className="h-3 w-3" /> How it works
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">
            From booking to boarding in 4 steps
          </h2>
          <p className="mt-3 mx-auto max-w-xl text-muted-foreground">
            Designed for speed. No app store, no cash counter — just open the link and go.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={s.num}
              className={cn(
                "group relative animate-fade-in-up rounded-2xl border border-border bg-card p-6 transition-all duration-300",
                "hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5",
                ["stagger-1", "stagger-2", "stagger-3", "stagger-4"][i],
              )}
            >
              {/* Step number watermark */}
              <span className="absolute right-4 top-3 font-display text-5xl font-bold text-border/60 select-none transition-colors duration-300 group-hover:text-primary/10">
                {s.num}
              </span>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                {s.icon}
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Features section ──────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <Ticket />,
    title: "Digital Ticketing",
    desc: "Tap to book. Get a unique QR code instantly — no paper, no counter.",
    gradient: "from-blue-500/20 to-blue-600/5",
    iconBg: "bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white",
  },
  {
    icon: <ListOrdered />,
    title: "FIFO Queue",
    desc: "First in, first served. Your position is locked the moment you book.",
    gradient: "from-amber/20 to-amber/5",
    iconBg: "bg-amber/10 text-amber group-hover:bg-amber group-hover:text-[#0f2847]",
  },
  {
    icon: <Armchair />,
    title: "Seat Selection",
    desc: "Pick your preferred seat when booking. The system assigns it in FIFO order.",
    gradient: "from-purple-500/20 to-purple-600/5",
    iconBg: "bg-purple-500/10 text-purple-500 group-hover:bg-purple-500 group-hover:text-white",
  },
  {
    icon: <MapPin />,
    title: "Real-Time Tracking",
    desc: "Watch every coaster move live on the map. Know exactly where your bus is.",
    gradient: "from-green-500/20 to-green-600/5",
    iconBg: "bg-green-500/10 text-green-500 group-hover:bg-green-500 group-hover:text-white",
  },
  {
    icon: <Bell />,
    title: "ETA Notifications",
    desc: "Get alerted when your bus is boarding or approaching your pickup point.",
    gradient: "from-orange-500/20 to-orange-600/5",
    iconBg: "bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white",
  },
  {
    icon: <Activity />,
    title: "Operations Dashboard",
    desc: "Operators monitor queue depth, seat loads, and ETAs across all coasters.",
    gradient: "from-rose-500/20 to-rose-600/5",
    iconBg: "bg-rose-500/10 text-rose-500 group-hover:bg-rose-500 group-hover:text-white",
  },
];

function FeaturesSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            Everything a student commuter needs
          </h2>
          <p className="mt-3 mx-auto max-w-2xl text-muted-foreground">
            Built for fairness, speed, and transparency — powered by a deterministic FIFO queue.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={cn(
                "group animate-fade-in-up relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300",
                "hover:-translate-y-1 hover:border-transparent hover:shadow-xl",
                ["stagger-1", "stagger-2", "stagger-3", "stagger-4", "stagger-1", "stagger-2"][i],
              )}
            >
              {/* Gradient background on hover */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                f.gradient,
              )} />
              <div className="relative">
                <div className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300",
                  f.iconBg,
                )}>
                  {f.icon}
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Routes section ────────────────────────────────────────────────────────────
function RoutesSection() {
  const routes = [
    { from: "Mansalay", to: "Roxas", fare: 60, color: "from-blue-500 to-blue-600" },
    { from: "Roxas", to: "Bulalacao", fare: 80, color: "from-purple-500 to-purple-600" },
    { from: "Mansalay", to: "Bulalacao", fare: 50, color: "from-green-500 to-green-600" },
  ];

  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/3 to-background" />
      <div className="container relative mx-auto px-4">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            6 routes, both directions
          </h2>
          <p className="mt-3 mx-auto max-w-xl text-muted-foreground">
            All three corridors run in both directions. Pick your origin and destination when booking.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {routes.map((r, i) => (
            <div
              key={r.from + r.to}
              className={cn(
                "group animate-fade-in-up rounded-2xl border border-border bg-card p-6 transition-all duration-300",
                "hover:-translate-y-1 hover:shadow-xl hover:border-transparent",
                ["stagger-1", "stagger-2", "stagger-3"][i],
              )}
            >
              <div className={cn(
                "h-1.5 w-12 rounded-full bg-gradient-to-r transition-all duration-300 group-hover:w-full",
                r.color,
              )} />
              <div className="mt-4 flex items-center gap-2 font-display text-lg font-bold">
                <span>{r.from}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" />
                <span>{r.to}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowRight className="h-3 w-3 rotate-180" />
                <span>{r.to} → {r.from}</span>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Fare</span>
                <span className="font-display text-2xl font-bold text-amber">₱{r.fare}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA section ───────────────────────────────────────────────────────────────
function CTASection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1628] via-[#0f2847] to-[#1a3a5c] p-10 text-center sm:p-16">
          {/* Decorative glows */}
          <div className="absolute -top-16 -left-16 h-64 w-64 rounded-full bg-amber/15 blur-3xl" />
          <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="relative">
            <img
              src="/image/coasterBus-logo.png"
              alt="CoasterBusForU"
              className="mx-auto h-16 w-16 rounded-2xl object-contain shadow-xl shadow-amber/30 ring-2 ring-amber/20"
            />
            <h2 className="mt-6 font-display text-3xl font-bold text-white sm:text-4xl">
              Ready to ride smarter?
            </h2>
            <p className="mt-3 mx-auto max-w-lg text-lg text-white/70">
              Join Romanbul students who book their coaster seat in seconds — no paper, no waiting in line.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/book">
                <Button
                  size="lg"
                  className="btn-press group gap-2 bg-gradient-to-r from-amber-400 to-yellow-300 font-semibold text-[#0f2847] shadow-lg shadow-amber/30 transition-all duration-300 hover:shadow-amber/50 hover:shadow-xl"
                >
                  Book a seat now
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="btn-press border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/10"
                >
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <RoutesSection />
      <CTASection />
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © 2026 CoasterBusForU · Romanbul Student Transport
      </footer>
    </div>
  );
}

// ── Live stats ────────────────────────────────────────────────────────────────
function LiveStats() {
  const [routeCount, setRouteCount] = useState<string>("—");
  const [busCount, setBusCount] = useState<string>("—");
  const [avgEta, setAvgEta] = useState<string>("—");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "buses"),
      (snap) => {
        const buses = snap.docs.map((d) => d.data());
        const routes = new Set(buses.map((b) => b.routeId as string | undefined).filter(Boolean));
        const active = buses.filter((b) => b.status && b.status !== "idle");
        const etas = buses.map((b) => (b.etaMinutes as number) ?? 0).filter((e) => e > 0);
        setRouteCount(String(routes.size));
        setBusCount(String(active.length > 0 ? active.length : buses.length));
        setAvgEta(etas.length > 0 ? `${Math.round(etas.reduce((a, b) => a + b, 0) / etas.length)} min` : "—");
      },
      () => { setRouteCount("—"); setBusCount("—"); setAvgEta("—"); },
    );
    return unsub;
  }, []);

  return (
    <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-surface-foreground/10 pt-8">
      {[
        { label: "Active routes", value: routeCount },
        { label: "Coasters online", value: busCount },
        { label: "Avg ETA", value: avgEta },
      ].map((s) => (
        <div key={s.label} className="group">
          <dt className="text-xs uppercase tracking-widest text-surface-foreground/50">{s.label}</dt>
          <dd className="mt-1 font-display text-3xl font-bold text-amber transition-transform duration-200 group-hover:scale-105">
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
