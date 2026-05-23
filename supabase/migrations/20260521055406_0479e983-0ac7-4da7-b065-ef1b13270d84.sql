
ALTER TABLE public.buses ADD COLUMN IF NOT EXISTS driver_id uuid;

CREATE POLICY "Drivers update assigned bus"
ON public.buses FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'driver'::app_role)
  AND (driver_id IS NULL OR driver_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'driver'::app_role)
  AND (driver_id = auth.uid() OR driver_id IS NULL)
);
