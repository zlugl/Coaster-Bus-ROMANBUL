import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/integrations/firebase";
import { useAuth } from "@/hooks/use-auth";

export function useUnreadCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      where("read", "==", false),
    );
    const unsub = onSnapshot(q, (snap) => setCount(snap.size));
    return unsub;
  }, [user]);

  return count;
}
