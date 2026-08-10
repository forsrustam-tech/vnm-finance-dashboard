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
  connected_by   INTEGER REFERENCES users(id),
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_connections_project_id ON ad_account_connections(project_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_connection_id ON ad_spend_snapshots(connection_id);

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
