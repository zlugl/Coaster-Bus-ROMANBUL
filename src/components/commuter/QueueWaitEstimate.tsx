import {
  estimateQueueWaitMinutes,
  formatQueueWait,
} from "@/lib/commuter";
import { cn } from "@/lib/utils";
import { Hourglass } from "lucide-react";

export function QueueWaitEstimate({
  queuePosition,
  busEtaMinutes,
  busStatus,
  className,
  compact,
}: {
  queuePosition: number;
  busEtaMinutes: number;
  busStatus: string;
  className?: string;
  compact?: boolean;
}) {
  const minutes = estimateQueueWaitMinutes(
    queuePosition,
    busEtaMinutes,
    busStatus,
  );
  const label = formatQueueWait(minutes);

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium text-warning-foreground",
          className,
        )}
      >
        <Hourglass className="h-3 w-3" />
        Est. wait {label}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2.5 text-sm animate-fade-in-up",
        className,
      )}
    >
      <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div>
        <p className="font-semibold text-warning-foreground">
          Estimated wait: {label}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Based on queue position, bus ETA, and average boarding time. Updates as
          the line moves.
        </p>
      </div>
    </div>
  );
}
