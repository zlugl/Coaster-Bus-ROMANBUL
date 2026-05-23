import { crowdLevel, CROWD_COPY } from "@/lib/commuter";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

export function CrowdBadge({
  filled,
  capacity,
  className,
}: {
  filled: number;
  capacity: number;
  className?: string;
}) {
  const level = crowdLevel(filled, capacity);
  const copy = CROWD_COPY[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        copy.className,
        className,
      )}
    >
      <Users className="h-3 w-3" />
      {copy.label}
    </span>
  );
}
