-- Add dispatch_fee: per-restaurant flat fee charged on every delivery order
-- Add price_markup_percent: percentage markup applied to menu item prices on the platform
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS dispatch_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_markup_percent numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN restaurants.dispatch_fee IS 'Flat fee (USD) added as a line item on every delivery order for this restaurant';
COMMENT ON COLUMN restaurants.price_markup_percent IS 'Percentage markup applied to all menu item prices when displayed to customers. Prices are rounded up to nearest $0.05';
