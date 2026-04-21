-- Add display_order column to catering_branches table for manual sorting
ALTER TABLE catering_branches 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Update existing rows to have sequential display_order based on name
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY catering_restaurant_id ORDER BY name) as rn
  FROM catering_branches
)
UPDATE catering_branches 
SET display_order = numbered.rn
FROM numbered
WHERE catering_branches.id = numbered.id;

-- Create index for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_catering_branches_display_order 
ON catering_branches(catering_restaurant_id, display_order);
