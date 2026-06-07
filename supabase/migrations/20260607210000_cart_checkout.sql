-- Drop existing create_booking if necessary or just create a new one for carts
CREATE OR REPLACE FUNCTION create_cart_bookings(
  p_property_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_check_in date,
  p_check_out date,
  p_cart_items jsonb -- Array of { room_type_id: uuid, quantity: int, guests_per_room: int }
)
RETURNS uuid AS $$
DECLARE
  v_booking_group_id uuid;
  v_item jsonb;
  v_room_type_id uuid;
  v_quantity int;
  v_guests int;
  v_unit_id uuid;
  v_i int;
BEGIN
  -- Generate a single group ID for this checkout session
  v_booking_group_id := gen_random_uuid();

  -- Loop through each item in the cart
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
  LOOP
    v_room_type_id := (v_item->>'room_type_id')::uuid;
    v_quantity := (v_item->>'quantity')::int;
    v_guests := COALESCE((v_item->>'guests_per_room')::int, 1);

    -- Loop to assign exact quantity of room units
    FOR v_i IN 1..v_quantity
    LOOP
      -- Find an available room unit for this room_type
      SELECT ru.id INTO v_unit_id
      FROM room_units ru
      WHERE ru.room_type_id = v_room_type_id
        AND ru.status = 'Active'
        AND NOT EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.room_unit_id = ru.id
            AND b.booking_status IN ('Pending', 'Confirmed')
            AND b.check_in < p_check_out
            AND b.check_out > p_check_in
        )
        AND NOT EXISTS (
          SELECT 1 FROM blocked_dates bd
          WHERE bd.room_unit_id = ru.id
            AND bd.start_date < p_check_out
            AND bd.end_date > p_check_in
        )
      LIMIT 1;

      IF v_unit_id IS NULL THEN
        RAISE EXCEPTION 'Not enough available units for room type %', v_room_type_id;
      END IF;

      -- Create the booking record
      INSERT INTO bookings (
        property_id,
        room_unit_id,
        guest_name,
        guest_email,
        guest_phone,
        check_in,
        check_out,
        guests,
        booking_status,
        payment_status,
        booking_group_id
      ) VALUES (
        p_property_id,
        v_unit_id,
        p_guest_name,
        p_guest_email,
        p_guest_phone,
        p_check_in,
        p_check_out,
        v_guests,
        'Pending',
        'Pending',
        v_booking_group_id
      );
    END LOOP;
  END LOOP;

  RETURN v_booking_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
