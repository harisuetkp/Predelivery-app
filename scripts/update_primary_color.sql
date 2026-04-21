-- Update all restaurants to use the new brand color #d00169
-- This updates all existing restaurants to the new magenta primary color

UPDATE restaurants
SET primary_color = '#d00169'
WHERE primary_color IS NULL 
   OR primary_color = '#ef4444' 
   OR primary_color = '#EF4444'
   OR primary_color = '#6B1F1F';

-- Show count of updated restaurants
SELECT COUNT(*) as updated_restaurants FROM restaurants WHERE primary_color = '#d00169';
