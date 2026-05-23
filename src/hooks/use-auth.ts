import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { firebaseAuth, db } from "@/integrations/firebase";

export type AppRole = "admin" | "operator" | "student" | "driver" | "conductor";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        const ref = doc(db, "users", fbUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setRoles((snap.data()?.roles as AppRole[]) ?? ["student"]);
        } else {
          // First sign-in — create the user document with default student role
          await setDoc(ref, {
            email: fbUser.email ?? "",
            fullName: fbUser.displayName ?? "",
            studentId: "",
            phone: "",
            roles: ["student"],
            createdAt: serverTimestamp(),
          });
          setRoles(["student"]);
        }
      } else {
        setRoles([]);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return {
    user,
    roles,
    loading,
    isAdmin: roles.includes("admin") || roles.includes("operator"),
    isDriver: roles.includes("driver"),
    isConductor: roles.includes("conductor"),
    signOut: () => fbSignOut(firebaseAuth),
  };
}
