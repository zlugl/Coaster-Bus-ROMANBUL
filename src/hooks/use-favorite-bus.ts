import { useCallback, useState } from "react";
import { toast } from "sonner";

function storageKey(uid: string) {
  return `cbf-favorite-bus:${uid}`;
}

export function useFavoriteBus(userId: string | undefined) {
  const [favoriteBusId, setFavoriteBusId] = useState<string | null>(() => {
    if (!userId || typeof localStorage === "undefined") return null;
    return localStorage.getItem(storageKey(userId));
  });

  const toggleFavorite = useCallback(
    (busId: string, plateLabel?: string) => {
      if (!userId) return;
      setFavoriteBusId((prev) => {
        const next = prev === busId ? null : busId;
        if (next) {
          localStorage.setItem(storageKey(userId), next);
          toast.success(
            plateLabel ? `${plateLabel} pinned to top` : "Bus pinned to top",
          );
        } else {
          localStorage.removeItem(storageKey(userId));
          toast.info("Favorite bus removed");
        }
        return next;
      });
    },
    [userId],
  );

  const isFavorite = useCallback(
    (busId: string) => favoriteBusId === busId,
    [favoriteBusId],
  );

  return { favoriteBusId, toggleFavorite, isFavorite };
}
