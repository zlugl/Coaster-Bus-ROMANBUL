import { Link, useRouter } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, Ticket, Map, Bell, Radio, ClipboardCheck, UserCircle, CirclePlus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUnreadCount } from "@/hooks/use-unread-count";
import { Button } from "@/components/ui/button";

export function AppNav() {
  const { user, isAdmin, isDriver, isConductor, signOut } = useAuth();
  const unread = useUnreadCount();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <>
      {/* ── Desktop top bar ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-lg supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/image/coasterBus-logo.png"
              alt="CoasterBusForU logo"
              className="h-9 w-9 rounded-lg object-contain"
            />
            <div className="flex flex-col leading-none">
              <span className="font-display text-base font-bold tracking-tight">
                CoasterBus<span className="text-amber">ForU</span>
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Romanbul · 2026
              </span>
            </div>
          </Link>

          {user && (
            <nav className="hidden items-center gap-1 md:flex">
              {isAdmin ? (
                <>
                  <NavLink to="/admin" icon={<LayoutDashboard className="h-4 w-4" />}>Operations</NavLink>
                  <NavLink to="/tracking" icon={<Map className="h-4 w-4" />}>Fleet map</NavLink>
                </>
              ) : isDriver ? (
                <>
                  <NavLink to="/driver" icon={<Radio className="h-4 w-4" />}>Drive</NavLink>
                  <NavLink to="/tracking" icon={<Map className="h-4 w-4" />}>Map</NavLink>
                  <NavLink to="/profile" icon={<UserCircle className="h-4 w-4" />}>Profile</NavLink>
                </>
              ) : isConductor ? (
                <>
                  <NavLink to="/conductor" icon={<ClipboardCheck className="h-4 w-4" />}>Conduct</NavLink>
                  <NavLink to="/tracking" icon={<Map className="h-4 w-4" />}>Map</NavLink>
                  <NavLink to="/profile" icon={<UserCircle className="h-4 w-4" />}>Profile</NavLink>
                </>
              ) : (
                <>
                  <NavLink to="/book" icon={<CirclePlus className="h-4 w-4" />}>Book</NavLink>
                  <NavLink to="/tickets" icon={<Ticket className="h-4 w-4" />}>My Tickets</NavLink>
                  <NavLink to="/tracking" icon={<Map className="h-4 w-4" />}>Tracking</NavLink>
                  <NavLink to="/notifications" icon={<Bell className="h-4 w-4" />} badge={unread}>
                    Alerts
                  </NavLink>
                  <NavLink to="/profile" icon={<UserCircle className="h-4 w-4" />}>Profile</NavLink>
                </>
              )}
            </nav>
          )}

          <div className="flex items-center gap-2">
            {user ? (
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            ) : (
              <Link to="/login">
                <Button size="sm">Sign in</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile bottom tab bar (only when signed in) ── */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="flex h-14 min-h-[56px] items-stretch sm:h-16">
            {isAdmin ? (
              <>
                <BottomTab to="/admin" icon={<LayoutDashboard className="h-5 w-5" />} label="Ops" />
                <BottomTab to="/tracking" icon={<Map className="h-5 w-5" />} label="Map" />
              </>
            ) : isDriver ? (
              <>
                <BottomTab to="/driver" icon={<Radio className="h-5 w-5" />} label="Drive" />
                <BottomTab to="/tracking" icon={<Map className="h-5 w-5" />} label="Map" />
                <BottomTab to="/profile" icon={<UserCircle className="h-5 w-5" />} label="Profile" />
              </>
            ) : isConductor ? (
              <>
                <BottomTab to="/conductor" icon={<ClipboardCheck className="h-5 w-5" />} label="Conduct" />
                <BottomTab to="/tracking" icon={<Map className="h-5 w-5" />} label="Map" />
                <BottomTab to="/profile" icon={<UserCircle className="h-5 w-5" />} label="Profile" />
              </>
            ) : (
              <>
                <BottomTab to="/book" icon={<CirclePlus className="h-5 w-5" />} label="Book" />
                <BottomTab to="/tickets" icon={<Ticket className="h-5 w-5" />} label="Tickets" />
                <BottomTab to="/tracking" icon={<Map className="h-5 w-5" />} label="Track" />
                <BottomTab to="/notifications" icon={<Bell className="h-5 w-5" />} label="Alerts" badge={unread} />
                <BottomTab to="/profile" icon={<UserCircle className="h-5 w-5" />} label="Profile" />
              </>
            )}
          </div>
        </nav>
      )}

      {/* Spacer so content isn't hidden behind the bottom bar on mobile */}
      {user && <div className="h-16 md:hidden" />}
    </>
  );
}

function NavLink({
  to,
  icon,
  children,
  badge,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className="relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground"
      activeProps={{ className: "bg-secondary text-foreground font-semibold ring-1 ring-border" }}
      activeOptions={{ exact: false }}
    >
      {icon}
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}

function BottomTab({
  to,
  icon,
  label,
  badge,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className="relative flex flex-1 flex-col items-center justify-center gap-0.5 border-t-2 border-transparent text-muted-foreground transition-all duration-200 active:scale-95"
      activeProps={{ className: "border-amber bg-amber/5 text-amber" }}
      activeOptions={{ exact: false }}
    >
      <span className="relative">
        {icon}
        {badge != null && badge > 0 && (
          <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-widest">{label}</span>
    </Link>
  );
}
