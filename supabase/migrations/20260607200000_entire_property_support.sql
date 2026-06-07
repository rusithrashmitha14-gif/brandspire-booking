-- Safely add is_entire_property to room_types
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='room_types' AND column_name='is_entire_property') THEN 
    ALTER TABLE room_types ADD COLUMN is_entire_property boolean DEFAULT false;
  END IF; 
END $$;

-- Safely add booking_group_id to bookings
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='booking_group_id') THEN 
    ALTER TABLE bookings ADD COLUMN booking_group_id uuid DEFAULT gen_random_uuid();
  END IF; 
END $$;

-- Drop the function first to avoid return type conflict errors
DROP FUNCTION IF EXISTS get_available_room_types(uuid, date, date, integer);

-- Recreate the get_available_room_types function to handle entire property logic
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
  max_adults integer,
  max_children integer,
  price numeric,
  featured_image text,
  available_units integer,
  bed_type text,
  view_type text,
  gallery_images text[],
  amenities text[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rt.id as room_type_id,
    rt.title,
    rt.description,
    rt.max_adults,
    rt.max_children,
    rt.price,
    rt.featured_image,
    COUNT(ru.id)::integer as available_units,
    rt.bed_type,
    rt.view_type,
    rt.gallery_images,
    (
      SELECT array_agg(a.name)
      FROM room_amenities ra
      JOIN amenities a ON a.id = ra.amenity_id
      WHERE ra.room_type_id = rt.id
    ) as amenities
  FROM room_types rt
  JOIN room_units ru ON ru.room_type_id = rt.id
  WHERE rt.property_id = p_property_id
    AND rt.status = 'Active'
    AND (rt.max_adults + COALESCE(rt.max_children, 0)) >= p_guests
    AND ru.status = 'Active'
    AND NOT EXISTS (
      -- Check for overlapping bookings on this specific room unit
      SELECT 1 FROM bookings b
      WHERE b.room_unit_id = ru.id
        AND b.booking_status IN ('Pending', 'Confirmed')
        AND b.check_in < p_check_out
        AND b.check_out > p_check_in
    )
    AND NOT EXISTS (
      -- Check for blocked dates on this specific room unit
      SELECT 1 FROM blocked_dates bd
      WHERE bd.room_unit_id = ru.id
        AND bd.start_date < p_check_out
        AND bd.end_date > p_check_in
    )
    AND NOT EXISTS (
      -- If any 'Entire Property' room is booked, block EVERYTHING
      SELECT 1 FROM bookings b
      JOIN room_units bru ON b.room_unit_id = bru.id
      JOIN room_types brt ON bru.room_type_id = brt.id
      WHERE brt.is_entire_property = true
        AND brt.property_id = p_property_id
        AND b.booking_status IN ('Pending', 'Confirmed')
        AND b.check_in < p_check_out
        AND b.check_out > p_check_in
    )
    AND NOT (
      -- If THIS room type is an 'Entire Property' room, ensure absolutely NO OTHER room in the property is booked
      rt.is_entire_property = true AND EXISTS (
        SELECT 1 FROM bookings b
        JOIN room_units bru ON b.room_unit_id = bru.id
        JOIN room_types brt ON bru.room_type_id = brt.id
        WHERE brt.property_id = p_property_id
          AND b.booking_status IN ('Pending', 'Confirmed')
          AND b.check_in < p_check_out
          AND b.check_out > p_check_in
      )
    )
  GROUP BY rt.id
  HAVING COUNT(ru.id) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
