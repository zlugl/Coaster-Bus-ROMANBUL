import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/integrations/firebase";
import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/hooks/use-auth";
import { Bell, CheckCheck, Map, Ticket } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notifications · CoasterBusForU" }] }),
});

type Notif = { id: string; title: string; message: string; read: boolean; createdAt: { seconds: number } | null };

function NotificationsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "notifications"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as Notif)));
    });
    return unsub;
  }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    const batch = writeBatch(db);
    items.filter((n) => !n.read).forEach((n) => batch.update(doc(db, "notifications", n.id), { read: true }));
    await batch.commit();
  };

  const markRead = (id: string) => {
    updateDoc(doc(db, "notifications", id), { read: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="container mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center justify-between">
          <div><h1 className="font-display text-3xl font-bold">ETA Alerts</h1><p className="text-muted-foreground">Bus arrival notifications</p></div>
          <Button variant="outline" size="sm" onClick={markAllRead}><CheckCheck className="h-4 w-4" /> Mark all read</Button>
        </div>
        <div className="mt-6 space-y-2">
          {items.length === 0 && <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground"><Bell className="mx-auto h-8 w-8" /><p className="mt-2">No notifications yet.</p><p className="mt-1 text-xs">You&apos;ll see alerts when your bus is boarding or nearby.</p></div>}
          {items.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border border-border p-4 ${n.read ? "bg-card" : "bg-accent/10 border-accent/30"}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-muted-foreground/30" : "bg-accent"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{n.title}</h3>
                    <span className="shrink-0 text-xs text-muted-foreground">{n.createdAt ? formatDistanceToNow(new Date(n.createdAt.seconds * 1000), { addSuffix: true }) : ""}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link to="/tickets" onClick={() => !n.read && markRead(n.id)}>
                      <Button size="sm" variant="outline" className="gap-1.5 h-8">
                        <Ticket className="h-3.5 w-3.5" /> My ticket
                      </Button>
                    </Link>
                    <Link to="/tracking" onClick={() => !n.read && markRead(n.id)}>
                      <Button size="sm" variant="outline" className="gap-1.5 h-8">
                        <Map className="h-3.5 w-3.5" /> Live map
                      </Button>
                    </Link>
                    {!n.read && (
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => markRead(n.id)}>
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
