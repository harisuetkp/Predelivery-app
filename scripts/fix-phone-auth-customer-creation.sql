-- Fix phone authentication customer creation
-- The handle_new_customer trigger was failing because email is required but phone auth users don't have email

-- 1. Make email nullable in customers table (phone-only users won't have email)
ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;

-- 2. Update the trigger function to handle phone-only signups
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if we have either email or phone
  -- Phone auth users have NEW.phone set, email auth users have NEW.email set
  IF NEW.email IS NOT NULL OR NEW.phone IS NOT NULL THEN
    INSERT INTO public.customers (auth_user_id, email, phone, first_name, last_name)
    VALUES (
      NEW.id,
      NEW.email,  -- Will be NULL for phone-only signups
      NEW.phone,  -- Will be NULL for email-only signups
      COALESCE(NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'full_name', NULL),
      COALESCE(NEW.raw_user_meta_data ->> 'last_name', NULL)
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, customers.email),
      phone = COALESCE(EXCLUDED.phone, customers.phone),
      first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
      last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_auth_user_created_customer ON auth.users;

CREATE TRIGGER on_auth_user_created_customer
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_customer();
