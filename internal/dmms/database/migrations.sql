PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS dmms_users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('pm','contributor','admin')),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS dmms_reward_ledger;
DROP TABLE IF EXISTS dmms_task_comments;
DROP TABLE IF EXISTS dmms_projects;

CREATE TABLE IF NOT EXISTS dmms_projects (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT,
  pm_id            TEXT NOT NULL REFERENCES dmms_users(id),
  budget_total     REAL NOT NULL DEFAULT 0,
  budget_allocated REAL NOT NULL DEFAULT 0,
  budget_saved     REAL NOT NULL DEFAULT 0,
  start_date       DATETIME,
  end_date         DATETIME,
  status           TEXT NOT NULL CHECK (status IN ('draft','active','completed','cancelled')) DEFAULT 'draft',
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS dmms_submissions;
DROP TABLE IF EXISTS dmms_proposals;
DROP TABLE IF EXISTS dmms_deliverables;

CREATE TABLE IF NOT EXISTS dmms_deliverables (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES dmms_projects(id) ON DELETE CASCADE,
  parent_id           TEXT REFERENCES dmms_deliverables(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  brief               TEXT,
  scope               TEXT,
  acceptance_criteria TEXT DEFAULT '[]',
  max_budget          REAL NOT NULL DEFAULT 0,
  accepted_budget     REAL,
  due_date            DATETIME,
  dependency_id       TEXT REFERENCES dmms_deliverables(id),
  visibility          TEXT NOT NULL CHECK (visibility IN ('public','private')) DEFAULT 'public',
  status              TEXT NOT NULL CHECK (status IN ('draft','open_for_bids','assigned','in_progress','submitted','approved','revision_requested','cancelled','rejected')) DEFAULT 'draft',
  owner_id            TEXT REFERENCES dmms_users(id),
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_deliv_project ON dmms_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_deliv_parent  ON dmms_deliverables(parent_id);
CREATE INDEX IF NOT EXISTS idx_deliv_owner   ON dmms_deliverables(owner_id);
CREATE INDEX IF NOT EXISTS idx_deliv_status  ON dmms_deliverables(status);

DROP TABLE IF EXISTS dmms_kanban_tasks;
DROP TABLE IF EXISTS dmms_subtasks;
-- If dmms_tasks exists from an old version without project_id, we must recreate it
DROP TABLE IF EXISTS dmms_tasks;

-- Tasks (Unified checklist, daily tracking, and subtasks)
CREATE TABLE IF NOT EXISTS dmms_tasks (
  id             TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL REFERENCES dmms_deliverables(id) ON DELETE CASCADE,
  project_id     TEXT NOT NULL REFERENCES dmms_projects(id) ON DELETE CASCADE,
  created_by     TEXT NOT NULL REFERENCES dmms_users(id),
  assigned_to    TEXT REFERENCES dmms_users(id),
  title          TEXT NOT NULL,
  description    TEXT DEFAULT '',
  status         TEXT NOT NULL CHECK (status IN ('backlog','todo','in_progress','done')) DEFAULT 'todo',
  is_required    INTEGER NOT NULL DEFAULT 0, -- 1 for PM checklist, 0 for contributor subtasks
  due_date       DATETIME,
  position       INTEGER NOT NULL DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_task_deliverable ON dmms_tasks(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_task_project     ON dmms_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_task_assigned    ON dmms_tasks(assigned_to);

-- Task comments
CREATE TABLE IF NOT EXISTS dmms_task_comments (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES dmms_tasks(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES dmms_users(id),
  body       TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tcomment_task ON dmms_task_comments(task_id);

CREATE TABLE IF NOT EXISTS dmms_proposals (
  id             TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL REFERENCES dmms_deliverables(id) ON DELETE CASCADE,
  contributor_id TEXT NOT NULL REFERENCES dmms_users(id),
  bid_amount     REAL NOT NULL,
  eta_date       DATETIME,
  message        TEXT,
  status         TEXT NOT NULL CHECK (status IN ('pending','accepted','rejected','withdrawn')) DEFAULT 'pending',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(deliverable_id, contributor_id)
);
CREATE INDEX IF NOT EXISTS idx_prop_deliv ON dmms_proposals(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_prop_user  ON dmms_proposals(contributor_id);

CREATE TABLE IF NOT EXISTS dmms_submissions (
  id                   TEXT PRIMARY KEY,
  deliverable_id       TEXT NOT NULL REFERENCES dmms_deliverables(id) ON DELETE CASCADE,
  contributor_id       TEXT NOT NULL REFERENCES dmms_users(id),
  notes                TEXT,
  checklist_completion TEXT DEFAULT '{}',
  file_uploads         TEXT DEFAULT '[]',
  pr_links             TEXT DEFAULT '[]',
  status               TEXT NOT NULL CHECK (status IN ('pending','approved','revision_requested','rejected')) DEFAULT 'pending',
  reviewer_id          TEXT REFERENCES dmms_users(id),
  review_notes         TEXT,
  submitted_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at          DATETIME
);
CREATE INDEX IF NOT EXISTS idx_sub_deliv ON dmms_submissions(deliverable_id);

CREATE TABLE IF NOT EXISTS dmms_reward_ledger (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES dmms_users(id),
  deliverable_id TEXT NOT NULL REFERENCES dmms_deliverables(id),
  project_id     TEXT NOT NULL REFERENCES dmms_projects(id),
  amount         REAL NOT NULL,
  approved_by    TEXT NOT NULL REFERENCES dmms_users(id),
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON dmms_reward_ledger(user_id);

