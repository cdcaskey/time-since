ALTER TABLE tasks ADD COLUMN initial_state TEXT
  CHECK (initial_state IS NULL OR initial_state IN ('ok', 'due', 'overdue', 'urgent'));
