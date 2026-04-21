-- Add availability_daypart column to menu_items for controlling which meal periods the item is available
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS availability_daypart TEXT DEFAULT 'all';

-- Add daypart time definitions to restaurants table
-- Default: Breakfast closed (no default start/end), Lunch 11:30am-4pm, Dinner 4pm-8:30pm
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS daypart_breakfast_start TIME DEFAULT NULL;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS daypart_breakfast_end TIME DEFAULT NULL;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS daypart_lunch_start TIME DEFAULT '11:30';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS daypart_lunch_end TIME DEFAULT '16:00';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS daypart_dinner_start TIME DEFAULT '16:00';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS daypart_dinner_end TIME DEFAULT '20:30';

-- Valid values for availability_daypart:
-- 'all' - Available all day (default)
-- 'breakfast_lunch' - Breakfast and Lunch
-- 'breakfast_dinner' - Breakfast and Dinner
-- 'lunch_dinner' - Lunch and Dinner
-- 'breakfast_only' - Breakfast Only
-- 'lunch_only' - Lunch Only
-- 'dinner_only' - Dinner Only
