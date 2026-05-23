/**
 * Ticket operations using Firestore.
 *
 * Queue position is tracked via a counter field on the bus document
 * (buses/{busId}.activeTicketCount) updated atomically in the transaction.
 * This avoids reading other users' tickets — which the security rules block.
 */
import {
  collection, doc, getDoc, updateDoc,
  query, where, getDocs,
  runTransaction, serverTimestamp, deleteDoc,
} from "firebase/firestore";
import { db } from "@/integrations/firebase";

export type PickupType    = "highway" | "terminal";
export type PaymentMethod = "cash" | "gcash";
export type TicketStatus  = "queued" | "confirmed" | "boarded" | "completed" | "cancelled";
export type PaymentStatus = "pending" | "paid";

function randomCode(len = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

// ── Book ticket ───────────────────────────────────────────────────────────────
export async function bookTicket(params: {
  userId: string;
  busId: string;
  pickupType: PickupType;
  preferredSeat: number | null;
  paymentMethod: PaymentMethod;
}): Promise<{ ok: true; ticket: Record<string, unknown> } | { ok: false; error: string }> {
  const { userId, busId, pickupType, preferredSeat, paymentMethod } = params;

  try {
    // Check if user already has an active ticket for this bus.
    // We only read THIS user's own tickets — allowed by security rules.
    const myTicketsSnap = await getDocs(
      query(collection(db, "tickets"), where("userId", "==", userId)),
    );
    const alreadyBooked = myTicketsSnap.docs.some((d) => {
      const t = d.data();
      return (
        t.busId === busId &&
        ["queued", "confirmed", "boarded"].includes(t.status)
      );
    });
    if (alreadyBooked) {
      return { ok: false, error: "You already have an active ticket for this bus." };
    }

    const ticketCode = randomCode(8);
    const ticketRef  = doc(collection(db, "tickets"));
    const notifRef   = doc(collection(db, "notifications"));
    const payLabel   = paymentMethod === "gcash" ? "GCash" : "cash on board";

    let queuePosition = 1;
    let seatNumber: number | null = null;
    let status: TicketStatus = "confirmed";

    await runTransaction(db, async (tx) => {
      // Read bus inside transaction
      const busRef  = doc(db, "buses", busId);
      const busSnap = await tx.get(busRef);
      if (!busSnap.exists()) throw new Error("Bus not found.");

      const busData  = busSnap.data();
      const capacity = (busData.capacity as number) ?? 14;

      // activeTicketCount is maintained on the bus doc.
      // If it doesn't exist yet, default to 0.
      const currentCount = (busData.activeTicketCount as number) ?? 0;

      queuePosition = currentCount + 1;
      seatNumber    = queuePosition <= capacity ? queuePosition : null;
      status        = queuePosition <= capacity ? "confirmed" : "queued";

      // Get current occupied seats array
      const currentOccupiedSeats = (busData.occupiedSeats as number[]) ?? [];

      // Increment the counter on the bus and update occupied seats if a seat is assigned
      if (seatNumber) {
        tx.update(busRef, {
          activeTicketCount: queuePosition,
          occupiedSeats: [...currentOccupiedSeats, seatNumber],
        });
      } else {
        tx.update(busRef, { activeTicketCount: queuePosition });
      }

      // Write ticket
      tx.set(ticketRef, {
        id: ticketRef.id,
        userId,
        busId,
        ticketCode,
        queuePosition,
        seatNumber,
        preferredSeat,
        status,
        pickupType,
        paymentMethod,
        paymentStatus: "pending" as PaymentStatus,
        createdAt: serverTimestamp(),
      });

      // Write notification
      tx.set(notifRef, {
        userId,
        title: status === "confirmed" ? "Seat confirmed" : "Added to queue",
        message:
          status === "confirmed"
            ? `Seat #${seatNumber} confirmed. Pay ${payLabel}. Ticket ${ticketCode}.`
            : `You're #${queuePosition} in the queue. Pay ${payLabel}. Ticket ${ticketCode}.`,
        read: false,
        createdAt: serverTimestamp(),
      });
    });

    return {
      ok: true,
      ticket: {
        id: ticketRef.id,
        ticketCode,
        queuePosition,
        seatNumber,
        status,
        pickupType,
        paymentMethod,
        paymentStatus: "pending",
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Booking failed." };
  }
}

// ── Cancel ticket ─────────────────────────────────────────────────────────────
export async function cancelTicket(params: {
  ticketId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ref  = doc(db, "tickets", params.ticketId);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().userId !== params.userId) {
      return { ok: false, error: "Ticket not found." };
    }
    // Decrement the bus counter when a ticket is cancelled
    const busId = snap.data().busId as string;
    const seatNumber = snap.data().seatNumber as number | null;
    await updateDoc(ref, { status: "cancelled" });
    try {
      const busRef  = doc(db, "buses", busId);
      const busSnap = await getDoc(busRef);
      if (busSnap.exists()) {
        const current = (busSnap.data().activeTicketCount as number) ?? 1;
        const currentOccupiedSeats = (busSnap.data().occupiedSeats as number[]) ?? [];
        const newOccupiedSeats = seatNumber ? currentOccupiedSeats.filter((s) => s !== seatNumber) : currentOccupiedSeats;
        await updateDoc(busRef, {
          activeTicketCount: Math.max(0, current - 1),
          occupiedSeats: newOccupiedSeats,
        });
      }
    } catch { /* ignore counter update failure */ }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Cancel failed." };
  }
}

// ── Verify payment (conductor) ────────────────────────────────────────────────
export async function verifyPayment(params: {
  ticketId: string;
  conductorId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const userSnap = await getDoc(doc(db, "users", params.conductorId));
    const roles: string[] = userSnap.data()?.roles ?? [];
    if (!roles.some((r) => ["conductor", "admin", "operator"].includes(r))) {
      return { ok: false, error: "Conductor access required." };
    }
    await updateDoc(doc(db, "tickets", params.ticketId), {
      paymentStatus: "paid",
      status: "confirmed",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Verify failed." };
  }
}

// ── Complete ticket (student marks arrival) ──────────────────────────────────
export async function completeTicket(params: {
  ticketId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ref = doc(db, "tickets", params.ticketId);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().userId !== params.userId) {
      return { ok: false, error: "Ticket not found." };
    }
    const ticketData = snap.data();
    const busId = ticketData.busId as string;
    const currentStatus = ticketData.status as string;

    // Only allow completion for boarded or confirmed tickets
    if (!["boarded", "confirmed"].includes(currentStatus)) {
      return { ok: false, error: "Ticket cannot be completed in its current status." };
    }

    // Update ticket status to completed
    await updateDoc(ref, { status: "completed" });

    // Decrement the bus counter to free up the seat and remove from occupiedSeats
    try {
      const busRef = doc(db, "buses", busId);
      const busSnap = await getDoc(busRef);
      if (busSnap.exists()) {
        const current = (busSnap.data().activeTicketCount as number) ?? 1;
        const seatNumber = ticketData.seatNumber as number | null;
        const currentOccupiedSeats = (busSnap.data().occupiedSeats as number[]) ?? [];
        const newOccupiedSeats = seatNumber ? currentOccupiedSeats.filter((s) => s !== seatNumber) : currentOccupiedSeats;
        await updateDoc(busRef, {
          activeTicketCount: Math.max(0, current - 1),
          occupiedSeats: newOccupiedSeats,
        });
      }
    } catch { /* ignore counter update failure */ }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Complete failed." };
  }
}

// ── Delete ticket (student removes completed ticket) ───────────────────────
export async function deleteTicket(params: {
  ticketId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ref = doc(db, "tickets", params.ticketId);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().userId !== params.userId) {
      return { ok: false, error: "Ticket not found." };
    }
    const ticketData = snap.data();
    const currentStatus = ticketData.status as string;

    // Only allow deletion for completed tickets
    if (currentStatus !== "completed") {
      return { ok: false, error: "Only completed tickets can be deleted." };
    }

    await deleteDoc(ref);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed." };
  }
}
