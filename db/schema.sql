-- Run this once against your Postgres (Vercel/Neon) database.

CREATE TABLE IF NOT EXISTS roles (
  id                     SERIAL PRIMARY KEY,
  name                   TEXT UNIQUE NOT NULL,
  can_view_all_finance   BOOLEAN NOT NULL DEFAULT false,
  can_manage_projects    BOOLEAN NOT NULL DEFAULT false,
  can_manage_users       BOOLEAN NOT NULL DEFAULT false,
  can_manage_roles       BOOLEAN NOT NULL DEFAULT false,
  is_system              BOOLEAN NOT NULL DEFAULT false, -- system roles (Owner) cannot be deleted
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- NULL until the user completes phone+password registration
  role_id       INTEGER NOT NULL REFERENCES roles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active', -- active | paused | finished
  revenue_amount   NUMERIC NOT NULL DEFAULT 0,      -- monthly revenue from this client
  payment_due_day  INTEGER,                          -- day of month client pays (1-31)
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_assignments (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payout_rate   NUMERIC NOT NULL DEFAULT 0, -- fixed payout per period for this targetolog on this project
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS payouts (
  id                     SERIAL PRIMARY KEY,
  project_assignment_id  INTEGER NOT NULL REFERENCES project_assignments(id) ON DELETE CASCADE,
  period                 TEXT NOT NULL, -- e.g. '2026-08'
  amount                 NUMERIC NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'pending', -- pending | paid
  paid_at                TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_assignment_id, period)
);

-- Phase 2: ad platform connections (Meta Ads first)
CREATE TABLE IF NOT EXISTS ad_account_connections (
  id             SERIAL PRIMARY KEY,
  project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  platform       TEXT NOT NULL DEFAULT 'meta',
  ad_account_id  TEXT,
  access_token   TEXT,
  currency       TEXT, -- account's billing currency from Meta (e.g. 'USD'), converted to ₸ for display
  connected_by   INTEGER REFERENCES users(id),
  connected_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ad_spend_snapshots (
  id           SERIAL PRIMARY KEY,
  connection_id INTEGER NOT NULL REFERENCES ad_account_connections(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  spend        NUMERIC NOT NULL DEFAULT 0,
  impressions  BIGINT NOT NULL DEFAULT 0,
  clicks       BIGINT NOT NULL DEFAULT 0,
  link_clicks  BIGINT NOT NULL DEFAULT 0, -- outbound clicks to the landing page, used for site conversion (leads / link_clicks)
  leads        BIGINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, date)
);

CREATE TABLE IF NOT EXISTS project_documents (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  pathname      TEXT NOT NULL, -- Vercel Blob pathname, used to generate signed download URLs
  content_type  TEXT,
  size_bytes    BIGINT,
  uploaded_by   INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A project can have more than one amoCRM account (e.g. separate branches/cities).
CREATE TABLE IF NOT EXISTS amo_connections (
  id             SERIAL PRIMARY KEY,
  project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label          TEXT NOT NULL, -- e.g. "Астана", "Алматы"
  subdomain      TEXT NOT NULL,
  access_token   TEXT NOT NULL, -- long-lived token from a private integration in the client's amoCRM
  webhook_secret TEXT, -- random token embedded in this connection's webhook URL, checked on every call
  booking_stage_name TEXT, -- which pipeline stage counts as "booked" (Записи) in the РНП table — display only
  booking_stage_id INTEGER, -- same stage, by id — drives the Events-API query (created_at is unreliable for "date entered this stage")
  connected_by   INTEGER REFERENCES users(id),
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_connections_project_id ON ad_account_connections(project_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_connection_id ON ad_spend_snapshots(connection_id);

-- Tracks whether each client (project) has paid the agency for a given month.
CREATE TABLE IF NOT EXISTS client_payments (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  period        TEXT NOT NULL, -- e.g. '2026-08'
  amount        NUMERIC NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | paid
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, period)
);

CREATE INDEX IF NOT EXISTS idx_client_payments_project_id ON client_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_assignments_project_id ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON project_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_assignment_id ON payouts(project_assignment_id);

-- Seed default roles
INSERT INTO roles (name, can_view_all_finance, can_manage_projects, can_manage_users, can_manage_roles, is_system)
VALUES ('Владелец', true, true, true, true, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (name, can_view_all_finance, can_manage_projects, can_manage_users, can_manage_roles, is_system)
VALUES ('Директор по маркетингу', true, true, true, false, false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (name, can_view_all_finance, can_manage_projects, can_manage_users, can_manage_roles, is_system)
VALUES ('Таргетолог', false, false, false, false, false)
ON CONFLICT (name) DO NOTHING;

-- RNP (РНП): daily amoCRM snapshot per connection — the single source of truth
-- that both the dashboard's per-project table and whatsapp-report-bot read
-- from, instead of each calling amoCRM's API independently. Filled by the
-- daily /api/cron/rnp-snapshot job. Mirrors ad_spend_snapshots in shape.
CREATE TABLE IF NOT EXISTS amo_daily_snapshots (
  id               SERIAL PRIMARY KEY,
  connection_id    INTEGER NOT NULL REFERENCES amo_connections(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  new_leads        INTEGER NOT NULL DEFAULT 0,
  total_lead_value NUMERIC NOT NULL DEFAULT 0, -- sum of price on leads created this day (pipeline value entering, not yet won)
  won_count        INTEGER NOT NULL DEFAULT 0,
  won_revenue      NUMERIC NOT NULL DEFAULT 0,
  booking_count    INTEGER NOT NULL DEFAULT 0, -- leads that transitioned INTO the connection's booking_stage_id on this day (via Events API — by_stage's snapshot-of-current-state can't tell entry date)
  by_stage         JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, date)
);

-- One editable plan per project per calendar month — prorated across weeks
-- in the РНП UI (weekly plan = monthly plan * days-in-week / days-in-month).
CREATE TABLE IF NOT EXISTS project_monthly_targets (
  id           SERIAL PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  period       TEXT NOT NULL, -- 'YYYY-MM'
  budget_plan  NUMERIC NOT NULL DEFAULT 0, -- ₸
  leads_plan   INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, period)
);

-- "Решения" — a short weekly decisions/notes log per project, shown next to
-- that week's numbers in the РНП table.
CREATE TABLE IF NOT EXISTS project_notes (
  id           SERIAL PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  week_start   DATE NOT NULL, -- Monday of the week this note is about
  note         TEXT NOT NULL,
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Training library: YouTube links the team can watch (onboarding, playbooks, etc).
CREATE TABLE IF NOT EXISTS training_videos (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  youtube_url   TEXT NOT NULL,
  youtube_id    TEXT NOT NULL,
  thumbnail_url TEXT,
  description   TEXT,
  category      TEXT,
  added_by      INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Maps a project to the WhatsApp group its daily amoCRM/ad-spend report is
-- posted into. Owned/read by the separate whatsapp-report-bot process
-- (~/whatsapp-report-bot), not by this Next.js app — kept here so the full
-- schema is documented in one place.
CREATE TABLE IF NOT EXISTS whatsapp_report_groups (
  id           SERIAL PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  group_jid    TEXT NOT NULL,          -- e.g. "1203630XXXXXXXXXX@g.us"
  group_label  TEXT,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, group_jid)
);
