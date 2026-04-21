-- Operations Control Panel Database Migration
-- Creates tables for platform settings, restaurant hours, and scheduled blocks

-- 1. Add new columns to restaurants table
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS payment_type VARCHAR(10) DEFAULT 'ach' CHECK (payment_type IN ('ach', 'pop')),
ADD COLUMN IF NOT EXISTS is_manually_blocked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS block_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMPTZ;

-- 2. Create platform_settings table (singleton for system-wide settings)
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_platform_open BOOLEAN DEFAULT true,
  is_pop_blocked BOOLEAN DEFAULT false,
  -- Configurable operating hours (editable via UI)
  operating_hours_start TIME DEFAULT '11:00',
  operating_hours_end TIME DEFAULT '20:30',
  -- Day-specific operating days
  operating_days JSONB DEFAULT '{"sunday": true, "monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": true}',
  emergency_block_active BOOLEAN DEFAULT false,
  emergency_block_reason TEXT,
  pop_reopen_at TIMESTAMPTZ,
  pop_block_message TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Insert default platform settings if not exists
INSERT INTO platform_settings (id, is_platform_open, operating_hours_start, operating_hours_end)
SELECT gen_random_uuid(), true, '11:00', '20:30'
WHERE NOT EXISTS (SELECT 1 FROM platform_settings);

-- 3. Create restaurant_hours table
CREATE TABLE IF NOT EXISTS restaurant_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  -- Breakfast shift
  breakfast_open TIME,
  breakfast_close TIME,
  -- Lunch shift
  lunch_open TIME,
  lunch_close TIME,
  -- Dinner shift
  dinner_open TIME,
  dinner_close TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, day_of_week)
);

-- 4. Create restaurant_hours_override table (for temporary changes)
CREATE TABLE IF NOT EXISTS restaurant_hours_override (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  -- Same structure as restaurant_hours
  breakfast_open TIME,
  breakfast_close TIME,
  lunch_open TIME,
  lunch_close TIME,
  dinner_open TIME,
  dinner_close TIME,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, override_date)
);

-- 5. Create scheduled_blocks table
CREATE TABLE IF NOT EXISTS scheduled_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE, -- NULL = system-wide or all POP
  block_type VARCHAR(20) NOT NULL CHECK (block_type IN ('system', 'restaurant', 'pop_bulk', 'temp')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create block_log table for audit trail
CREATE TABLE IF NOT EXISTS block_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL, -- 'blocked', 'unblocked', 'temp_block', 'pop_bulk_block', etc.
  block_type VARCHAR(20),
  reason TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_restaurant_hours_restaurant ON restaurant_hours(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_hours_override_restaurant_date ON restaurant_hours_override(restaurant_id, override_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_blocks_restaurant ON scheduled_blocks(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_blocks_active ON scheduled_blocks(is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_block_log_restaurant ON block_log(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_payment_type ON restaurants(payment_type);
CREATE INDEX IF NOT EXISTS idx_restaurants_blocked ON restaurants(is_manually_blocked);

-- Enable RLS on new tables
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_hours_override ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_log ENABLE ROW LEVEL SECURITY;

-- Create policies for platform_settings (read by all, write by authenticated)
CREATE POLICY "Anyone can view platform settings" ON platform_settings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can update platform settings" ON platform_settings FOR UPDATE USING (true);

-- Create policies for restaurant_hours (public read, authenticated write)
CREATE POLICY "Anyone can view restaurant hours" ON restaurant_hours FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage restaurant hours" ON restaurant_hours FOR ALL USING (true);

-- Create policies for restaurant_hours_override
CREATE POLICY "Anyone can view restaurant hours override" ON restaurant_hours_override FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage restaurant hours override" ON restaurant_hours_override FOR ALL USING (true);

-- Create policies for scheduled_blocks
CREATE POLICY "Anyone can view scheduled blocks" ON scheduled_blocks FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage scheduled blocks" ON scheduled_blocks FOR ALL USING (true);

-- Create policies for block_log
CREATE POLICY "Anyone can view block log" ON block_log FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create block log" ON block_log FOR INSERT WITH CHECK (true);
