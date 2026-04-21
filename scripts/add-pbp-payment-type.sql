-- Add PBP (Pay by Phone) to the payment_type check constraint

-- First, drop the existing constraint
ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS restaurants_payment_type_check;

-- Add the new constraint with pbp included
ALTER TABLE restaurants ADD CONSTRAINT restaurants_payment_type_check 
  CHECK (payment_type IN ('ach', 'pop', 'ath', 'pbp'));
