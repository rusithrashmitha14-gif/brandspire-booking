-- Availability Algorithm to find available room types based on room units
-- This function handles the exact overlap logic requested in the prompt.

CREATE OR REPLACE FUNCTION get_available_room_types(
  p_property_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer
)
RETURNS TABLE (
  room_type_id uuid,
  title text,
  description text,
  max_guests integer,
  price numeric,
  featured_image text,
  available_units integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rt.id as room_type_id,
    rt.title,
    rt.description,
    rt.max_guests,
    rt.price,
    rt.featured_image,
    COUNT(ru.id)::integer as available_units
  FROM room_types rt
  JOIN room_units ru ON ru.room_type_id = rt.id
  WHERE rt.property_id = p_property_id
    AND rt.status = 'Active'
    AND rt.max_guests >= p_guests
    AND ru.status = 'Active'
    AND NOT EXISTS (
      -- Check for overlapping bookings
      SELECT 1 FROM bookings b
      WHERE b.room_unit_id = ru.id
        AND b.booking_status IN ('Pending', 'Confirmed')
        AND b.check_in < p_check_out
        AND b.check_out > p_check_in
    )
    AND NOT EXISTS (
      -- Check for blocked dates
      SELECT 1 FROM blocked_dates bd
      WHERE bd.room_unit_id = ru.id
        AND bd.start_date < p_check_out
        AND bd.end_date > p_check_in
    )
  GROUP BY rt.id
  HAVING COUNT(ru.id) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
