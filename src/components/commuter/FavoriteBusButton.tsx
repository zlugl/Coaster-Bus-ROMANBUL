import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function FavoriteBusButton({
  active,
  onToggle,
  className,
}: {
  active: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={active ? "Remove favorite bus" : "Pin bus to top"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
        "hover:scale-110 active:scale-95",
        active
          ? "border-amber/50 bg-amber/20 text-amber shadow-sm shadow-amber/20"
          : "border-border bg-card text-muted-foreground hover:border-amber/40 hover:text-amber",
        className,
      )}
    >
      <Star
        className={cn("h-4 w-4 transition-transform", active && "fill-amber scale-110")}
      />
    </button>
  );
}
