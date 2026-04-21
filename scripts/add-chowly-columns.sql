-- Add Chowly and notification columns to restaurants table
-- These columns are needed for order notification settings

-- Add order notification method
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS order_notification_method TEXT DEFAULT 'email';

-- Add Chowly integration columns
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS chowly_enabled BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS chowly_api_key TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS chowly_location_id TEXT;

-- Add Square KDS integration
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS square_kds_enabled BOOLEAN DEFAULT false;

-- Add internal KDS settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS kds_enabled BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS kds_auto_print BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS kds_sound_enabled BOOLEAN DEFAULT true;
