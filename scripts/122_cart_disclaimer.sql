ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS cart_disclaimer text,
  ADD COLUMN IF NOT EXISTS dispatch_fee numeric NOT NULL DEFAULT 0;
