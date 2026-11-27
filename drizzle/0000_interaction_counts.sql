CREATE TABLE interaction_counts (
  day TEXT NOT NULL,
  page TEXT NOT NULL,
  control TEXT NOT NULL,
  screen TEXT NOT NULL CHECK (screen IN ('mobile', 'wide')),
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  placement TEXT NOT NULL,
  total INTEGER NOT NULL CHECK (total > 0),
  last_at TEXT NOT NULL,
  PRIMARY KEY (day, page, control, screen)
);
