-- Set all restaurants to use Stripe + ATH Movil as payment method
-- This updates both the payment_provider column and enables athmovil_enabled flag

UPDATE restaurants
SET 
  payment_provider = 'stripe_athmovil',
  athmovil_enabled = true,
  updated_at = NOW()
WHERE 1=1;

-- Show the updated restaurants
SELECT 
  id,
  name,
  slug,
  payment_provider,
  athmovil_enabled
FROM restaurants
ORDER BY name;
