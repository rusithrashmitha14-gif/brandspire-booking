-- Add external sync columns to blocked_dates
ALTER TABLE blocked_dates ADD COLUMN source text DEFAULT 'manual';
ALTER TABLE blocked_dates ADD COLUMN external_id uuid;

-- Add export token to room_units
ALTER TABLE room_units ADD COLUMN ical_export_token uuid DEFAULT gen_random_uuid();

-- Create table for managing imported iCal feeds
CREATE TABLE ical_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  room_unit_id uuid REFERENCES room_units(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- RLS for ical_imports
ALTER TABLE ical_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to ical_imports"
ON ical_imports FOR SELECT USING (true);

CREATE POLICY "Allow all access to authenticated users on ical_imports"
ON ical_imports FOR ALL USING (auth.role() = 'authenticated');
