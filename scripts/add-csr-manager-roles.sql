-- Migration: Add CSR and Manager roles to admin_users table
-- This updates the role check constraint to allow: super_admin, manager, csr, restaurant_admin

-- Drop the existing check constraint
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

-- Add the updated check constraint with new roles
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check 
  CHECK (role IN ('super_admin', 'manager', 'csr', 'restaurant_admin'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'admin_users'::regclass AND contype = 'c';
