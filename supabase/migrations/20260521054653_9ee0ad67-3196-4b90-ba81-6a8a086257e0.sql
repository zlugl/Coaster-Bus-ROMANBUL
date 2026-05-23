
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS origin_lat numeric,
  ADD COLUMN IF NOT EXISTS origin_lng numeric,
  ADD COLUMN IF NOT EXISTS dest_lat numeric,
  ADD COLUMN IF NOT EXISTS dest_lng numeric;

DELETE FROM public.tickets;
DELETE FROM public.buses;
DELETE FROM public.routes;

INSERT INTO public.routes (id, name, origin, destination, fare, origin_lat, origin_lng, dest_lat, dest_lng) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Mansalay - Roxas', 'Mansalay, Oriental Mindoro', 'Roxas, Oriental Mindoro', 60, 12.5180, 121.4380, 12.5847, 121.5108),
  ('22222222-2222-2222-2222-222222222222', 'Roxas - Bulalacao', 'Roxas, Oriental Mindoro', 'Bulalacao, Oriental Mindoro', 80, 12.5847, 121.5108, 12.3144, 121.3475),
  ('33333333-3333-3333-3333-333333333333', 'Mansalay - Bulalacao', 'Mansalay, Oriental Mindoro', 'Bulalacao, Oriental Mindoro', 50, 12.5180, 121.4380, 12.3144, 121.3475);

INSERT INTO public.buses (route_id, plate_number, capacity, status, eta_minutes, current_lat, current_lng) VALUES
  ('11111111-1111-1111-1111-111111111111', 'CBF-001', 14, 'in_transit', 15, 12.5500, 121.4740),
  ('22222222-2222-2222-2222-222222222222', 'CBF-002', 14, 'idle', 0, 12.5847, 121.5108),
  ('33333333-3333-3333-3333-333333333333', 'CBF-003', 14, 'in_transit', 25, 12.4100, 121.3900);
