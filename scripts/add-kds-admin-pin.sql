-- Add KDS admin PIN for secure exit from locked KDS mode
-- This PIN allows restaurant owners to exit the KDS PWA and access tablet settings

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS kds_admin_pin TEXT DEFAULT NULL;

-- Add same column to branches for branch-specific PINs
ALTER TABLE branches
ADD COLUMN IF NOT EXISTS kds_admin_pin TEXT DEFAULT NULL;

COMMENT ON COLUMN restaurants.kds_admin_pin IS 'PIN code for exiting KDS lock mode (4-6 digits). If NULL, admin exit is disabled.';
COMMENT ON COLUMN branches.kds_admin_pin IS 'Branch-specific PIN for exiting KDS lock mode. Falls back to restaurant PIN if NULL.';
