-- Update default design template to list-right for all restaurants
-- This sets "List Right (2 col)" as the default template

-- Update the default value for the column
ALTER TABLE restaurants 
ALTER COLUMN design_template SET DEFAULT 'list-right';

-- Update existing restaurants that still have the old default (classic)
UPDATE restaurants 
SET design_template = 'list-right' 
WHERE design_template = 'classic' OR design_template IS NULL;
