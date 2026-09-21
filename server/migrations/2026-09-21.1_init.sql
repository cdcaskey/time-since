CREATE TABLE tasks (
  id                    TEXT    PRIMARY KEY,
  name                  TEXT    NOT NULL,
  description           TEXT    NOT NULL DEFAULT '',
  due_after_seconds     INTEGER NOT NULL,
  overdue_after_seconds INTEGER NOT NULL,
  urgent_after_seconds  INTEGER NOT NULL,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL,
  CHECK (length(trim(name)) BETWEEN 1 AND 200),
  CHECK (due_after_seconds > 0),
  CHECK (overdue_after_seconds > due_after_seconds),
  CHECK (urgent_after_seconds > overdue_after_seconds)
);

CREATE TABLE completions (
  id           TEXT    PRIMARY KEY,
  task_id      TEXT    NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completed_at INTEGER NOT NULL,
  note         TEXT,
  created_at   INTEGER NOT NULL
);

CREATE INDEX idx_completions_task ON completions(task_id, completed_at DESC);
