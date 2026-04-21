-- Add cuisine_types array column to restaurants for multi-cuisine support
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS cuisine_types text[] DEFAULT '{}';

-- Populate from existing cuisine_type single value so no data is lost
UPDATE public.restaurants
  SET cuisine_types = ARRAY[cuisine_type]
  WHERE cuisine_type IS NOT NULL
    AND cuisine_type <> ''
    AND (cuisine_types IS NULL OR cuisine_types = '{}');
