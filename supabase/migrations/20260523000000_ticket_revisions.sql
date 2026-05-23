-- ─────────────────────────────────────────────────────────────────────────────
-- Ticket revisions: pickup type, seat preference, payment, proximity alerts
-- ─────────────────────────────────────────────────────────────────────────────

-- New enums
CREATE TYPE public.pickup_type    AS ENUM ('highway', 'terminal');
CREATE TYPE public.payment_method AS ENUM ('cash', 'gcash');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid');

-- Add new columns to tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS pickup_type    public.pickup_type    NOT NULL DEFAULT 'terminal',
  ADD COLUMN IF NOT EXISTS preferred_seat INT,
  ADD COLUMN IF NOT EXISTS payment_method public.payment_method NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'pending';

-- GCash number per bus — only admin can write (enforced by RLS below)
CREATE TABLE IF NOT EXISTS public.bus_gcash (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id     UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE UNIQUE,
  gcash_number TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bus_gcash ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read gcash numbers (students need to see them)
CREATE POLICY "Authenticated read gcash"
  ON public.bus_gcash FOR SELECT TO authenticated USING (true);

-- Only admin/operator can insert or update
CREATE POLICY "Admin manage gcash"
  ON public.bus_gcash FOR ALL TO authenticated
  USING  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- Enable realtime on bus_gcash so the booking page updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.bus_gcash;

-- Seed one gcash row per existing bus (empty number — admin fills it in)
INSERT INTO public.bus_gcash (bus_id, gcash_number)
SELECT id, '' FROM public.buses
ON CONFLICT (bus_id) DO NOTHING;
