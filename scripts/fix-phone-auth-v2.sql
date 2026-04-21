-- Fix phone authentication - make email nullable
ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;
