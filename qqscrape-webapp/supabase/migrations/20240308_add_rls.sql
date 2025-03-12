-- Enable RLS
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE charts ENABLE ROW LEVEL SECURITY;

-- Create policies for read-only access
CREATE POLICY "Allow public read-only access to tracks"
  ON tracks
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public read-only access to daily_snapshots"
  ON daily_snapshots
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public read-only access to charts"
  ON charts
  FOR SELECT
  TO anon
  USING (true);

-- Prevent any write operations from anon users
CREATE POLICY "Prevent public write access to tracks"
  ON tracks
  FOR ALL
  TO anon
  USING (false);

CREATE POLICY "Prevent public write access to daily_snapshots"
  ON daily_snapshots
  FOR ALL
  TO anon
  USING (false);

CREATE POLICY "Prevent public write access to charts"
  ON charts
  FOR ALL
  TO anon
  USING (false);

