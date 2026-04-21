-- Create a function to find users by phone number suffix (last 10 digits)
-- This allows reliable phone lookup regardless of format (+1, 1, etc.)

CREATE OR REPLACE FUNCTION get_user_by_phone_suffix(phone_suffix TEXT)
RETURNS TABLE (id UUID, phone TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.phone
  FROM auth.users u
  WHERE u.phone IS NOT NULL
    AND RIGHT(REGEXP_REPLACE(u.phone, '\D', '', 'g'), 10) = phone_suffix
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated and service role
GRANT EXECUTE ON FUNCTION get_user_by_phone_suffix(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_by_phone_suffix(TEXT) TO service_role;
