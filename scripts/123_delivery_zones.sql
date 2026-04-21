CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  zone_name text NOT NULL DEFAULT 'Standard Delivery',
  min_distance numeric NOT NULL DEFAULT 0,
  max_distance numeric NOT NULL DEFAULT 99,
  base_fee numeric NOT NULL DEFAULT 0,
  per_item_surcharge numeric NOT NULL DEFAULT 0,
  min_items_for_surcharge integer NOT NULL DEFAULT 50,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_zones_restaurant_id_idx ON public.delivery_zones(restaurant_id);
