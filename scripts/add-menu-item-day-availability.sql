-- Add day availability column to menu_items
-- Stores which days of the week the item is available
-- Format: JSONB with keys mon, tue, wed, thu, fri, sat, sun (all boolean)
-- Default: all days enabled (true)

ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS available_days JSONB 
DEFAULT '{"mon": true, "tue": true, "wed": true, "thu": true, "fri": true, "sat": true, "sun": true}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN menu_items.available_days IS 'Days of the week when this item is available. Keys: mon, tue, wed, thu, fri, sat, sun. Default: all true.';
