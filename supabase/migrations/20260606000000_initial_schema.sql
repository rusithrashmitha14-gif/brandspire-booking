-- Create Enum for Booking Status
CREATE TYPE booking_status AS ENUM ('Pending', 'Confirmed', 'Cancelled', 'Completed');

-- Create Properties Table
CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  address text,
  phone text,
  email text,
  logo text,
  hero_image text,
  description text,
  currency text DEFAULT 'USD',
  timezone text DEFAULT 'UTC',
  check_in_time time,
  check_out_time time,
  status text DEFAULT 'Active',
  created_at timestamptz DEFAULT now()
);

-- Create Room Types Table
CREATE TABLE room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  max_guests integer NOT NULL DEFAULT 1,
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL,
  featured_image text,
  status text DEFAULT 'Active',
  created_at timestamptz DEFAULT now()
);

-- Create Room Units Table
CREATE TABLE room_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id uuid REFERENCES room_types(id) ON DELETE CASCADE,
  room_number text NOT NULL,
  status text DEFAULT 'Active'
);

-- Create Bookings Table
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  room_unit_id uuid REFERENCES room_units(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  guest_email text,
  guest_phone text,
  check_in date NOT NULL,
  check_out date NOT NULL,
  guests integer NOT NULL DEFAULT 1,
  booking_status booking_status DEFAULT 'Pending',
  payment_status text DEFAULT 'Pending',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create Blocked Dates Table
CREATE TABLE blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  room_unit_id uuid REFERENCES room_units(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text
);

-- Create Gallery Table
CREATE TABLE gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  sort_order integer DEFAULT 0
);

-- Create Amenities Table
CREATE TABLE amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text
);

-- Create Room Amenities Join Table
CREATE TABLE room_amenities (
  room_type_id uuid REFERENCES room_types(id) ON DELETE CASCADE,
  amenity_id uuid REFERENCES amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (room_type_id, amenity_id)
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_amenities ENABLE ROW LEVEL SECURITY;

-- Note: We will add specific RLS policies matching the authenticated user's property_id shortly.
