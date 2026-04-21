-- Backfill item_options.prompt from category for all rows where prompt is null.
-- Since the original import stored option.group_name || option.prompt into category,
-- this seeds prompt with the best available label until a proper re-import is run.
UPDATE item_options
SET prompt = category
WHERE prompt IS NULL AND category IS NOT NULL;
