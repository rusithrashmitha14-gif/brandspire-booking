-- 1. Add user_id to properties
ALTER TABLE properties ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Assign existing properties to the first user
DO $$
DECLARE
    first_user_id uuid;
BEGIN
    SELECT id INTO first_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
    IF first_user_id IS NOT NULL THEN
        UPDATE properties SET user_id = first_user_id WHERE user_id IS NULL;
    END IF;
END $$;

-- 2. Add property_id to amenities
ALTER TABLE amenities ADD COLUMN property_id uuid REFERENCES properties(id) ON DELETE CASCADE;

-- Assign existing amenities to the first property
DO $$
DECLARE
    first_property_id uuid;
BEGIN
    SELECT id INTO first_property_id FROM properties ORDER BY created_at ASC LIMIT 1;
    IF first_property_id IS NOT NULL THEN
        UPDATE amenities SET property_id = first_property_id WHERE property_id IS NULL;
    END IF;
END $$;

-- Enable RLS everywhere explicitly
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

-- Disable old policies if they existed (just to be safe, though they don't seem to exist)
-- Let's just create new ones.

-- PROPERTIES POLICIES
CREATE POLICY "Owners can manage own properties" ON properties
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public can view all properties" ON properties
    FOR SELECT USING (true);


-- ROOM TYPES POLICIES
CREATE POLICY "Owners can manage room types" ON room_types
    FOR ALL USING (
        EXISTS (SELECT 1 FROM properties WHERE id = room_types.property_id AND user_id = auth.uid())
    );

CREATE POLICY "Public can view room types" ON room_types
    FOR SELECT USING (true);


-- ROOM UNITS POLICIES
CREATE POLICY "Owners can manage room units" ON room_units
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM room_types 
            JOIN properties ON properties.id = room_types.property_id 
            WHERE room_types.id = room_units.room_type_id AND properties.user_id = auth.uid()
        )
    );

CREATE POLICY "Public can view room units" ON room_units
    FOR SELECT USING (true);


-- AMENITIES POLICIES
CREATE POLICY "Owners can manage amenities" ON amenities
    FOR ALL USING (
        EXISTS (SELECT 1 FROM properties WHERE id = amenities.property_id AND user_id = auth.uid())
    );

CREATE POLICY "Public can view amenities" ON amenities
    FOR SELECT USING (true);


-- ROOM AMENITIES POLICIES
CREATE POLICY "Owners can manage room amenities" ON room_amenities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM room_types 
            JOIN properties ON properties.id = room_types.property_id 
            WHERE room_types.id = room_amenities.room_type_id AND properties.user_id = auth.uid()
        )
    );

CREATE POLICY "Public can view room amenities" ON room_amenities
    FOR SELECT USING (true);


-- GALLERY POLICIES
CREATE POLICY "Owners can manage gallery" ON gallery
    FOR ALL USING (
        EXISTS (SELECT 1 FROM properties WHERE id = gallery.property_id AND user_id = auth.uid())
    );

CREATE POLICY "Public can view gallery" ON gallery
    FOR SELECT USING (true);


-- BOOKINGS POLICIES
CREATE POLICY "Owners can manage bookings" ON bookings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM properties WHERE id = bookings.property_id AND user_id = auth.uid())
    );

CREATE POLICY "Public can create bookings" ON bookings
    FOR INSERT WITH CHECK (true);


-- BLOCKED DATES POLICIES
CREATE POLICY "Owners can manage blocked dates" ON blocked_dates
    FOR ALL USING (
        EXISTS (SELECT 1 FROM properties WHERE id = blocked_dates.property_id AND user_id = auth.uid())
    );

CREATE POLICY "Public can view blocked dates" ON blocked_dates
    FOR SELECT USING (true);


-- GUESTS POLICIES
CREATE POLICY "Owners can manage guests" ON guests
    FOR ALL USING (
        EXISTS (SELECT 1 FROM properties WHERE id = guests.property_id AND user_id = auth.uid())
    );
