-- Add internal shop operational control fields to platform_settings

-- Main on/off toggle for the shop
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS is_internal_shop_open boolean DEFAULT true;

-- Reopen time when shop is closed
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS internal_shop_reopen_at timestamptz;

-- Link shop availability to POP block status
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS internal_shop_link_to_pop boolean DEFAULT false;

-- Standalone order settings
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS internal_shop_standalone_enabled boolean DEFAULT false;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS internal_shop_delivery_fee numeric DEFAULT 3.00;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS internal_shop_min_order numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN platform_settings.is_internal_shop_open IS 'Manual on/off toggle for FoodNet Shop (Bebidas y Extras)';
COMMENT ON COLUMN platform_settings.internal_shop_reopen_at IS 'Scheduled reopen time when shop is manually closed';
COMMENT ON COLUMN platform_settings.internal_shop_link_to_pop IS 'When true, shop auto-closes when is_pop_blocked is true';
COMMENT ON COLUMN platform_settings.internal_shop_standalone_enabled IS 'When true, allows checkout with only shop items (no restaurant food)';
COMMENT ON COLUMN platform_settings.internal_shop_delivery_fee IS 'Delivery fee for standalone shop orders';
COMMENT ON COLUMN platform_settings.internal_shop_min_order IS 'Minimum order amount for standalone shop orders';
