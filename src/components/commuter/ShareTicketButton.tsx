import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/ux";
import { toast } from "sonner";

export function ShareTicketButton({
  ticketCode,
  routeName,
  busPlate,
  seatOrQueue,
}: {
  ticketCode: string;
  routeName: string;
  busPlate: string;
  seatOrQueue: string;
}) {
  const share = async () => {
    const text = [
      "CoasterBusForU ticket",
      `Code: ${ticketCode}`,
      `Bus: ${busPlate}`,
      routeName,
      seatOrQueue,
      window.location.origin + "/tickets",
    ].join("\n");

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: `Ticket ${ticketCode}`,
          text,
        });
        return;
      }
      const ok = await copyToClipboard(text);
      if (ok) toast.success("Ticket details copied — share with family or conductor");
      else toast.error("Could not share on this device");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error("Share cancelled or failed");
      }
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="gap-1.5 transition-transform hover:scale-[1.02] active:scale-95"
      onClick={share}
    >
      <Share2 className="h-4 w-4" />
      Share
    </Button>
  );
}
