-- ════════════════════════════════════════════════════════════════════════════
--  02-init-jobs.sql — Jobs domain (manuHunter)
--
--  Job-search tracker: one row per application, a response/status timeline,
--  and links from applications to stored artifacts (tailored CV, JD, cover
--  letter). Artifacts reuse the framework `files` table (MinIO-backed), so no
--  new storage layer is needed — see routes/framework/files.js.
--
--  Runs after 01-init-db.sql (alphabetical), so the users + files tables it
--  references already exist.
-- ════════════════════════════════════════════════════════════════════════════


-- #region Applications
-- One row per job application. user_id is nullable so demo/seed rows can exist
-- before the admin user is created at Node startup; real rows created through
-- the API are always stamped with the authenticated user's id.
CREATE TABLE applications (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        REFERENCES users(id) ON DELETE CASCADE,
    company         TEXT        NOT NULL,
    role            TEXT        NOT NULL,
    location        TEXT,
    source          TEXT,                       -- LinkedIn, referral, company site, ...
    job_url         TEXT,
    job_description TEXT,                        -- the pasted JD
    status          TEXT        NOT NULL DEFAULT 'draft',
                                                 -- draft | applied | screening | interview
                                                 -- | offer | rejected | ghosted | withdrawn
    salary          TEXT,
    contact         TEXT,
    notes           TEXT,
    applied_at      DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_applications_user   ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(status);
-- #endregion


-- #region Application events · response / status timeline
CREATE TABLE application_events (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID        NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    event_type     TEXT        NOT NULL,        -- status_change | response | interview | note
    detail         TEXT,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_application_events_app ON application_events(application_id);
-- #endregion


-- #region Application files · join to framework `files` (the CV artifact store)
CREATE TABLE application_files (
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    file_id        UUID NOT NULL REFERENCES files(id)        ON DELETE CASCADE,
    kind           TEXT NOT NULL DEFAULT 'cv',  -- cv | jd | cover
    PRIMARY KEY (application_id, file_id)
);
CREATE INDEX idx_application_files_app ON application_files(application_id);
-- #endregion


-- #region Seed · the first real application (CV_CoMind)
-- user_id left NULL; admin sees all rows regardless of owner. The tailored CV
-- PDF can be attached from the UI once the stack is up.
INSERT INTO applications (id, company, role, location, source, status, applied_at, job_description, notes)
VALUES (
    'aaaa0000-0000-4000-8000-000000000001',
    'CoMind',
    'Senior Data Scientist (Clinical)',
    'London, UK',
    'LinkedIn',
    'applied',
    '2026-07-01',
    'Senior Data Scientist (Clinical) at CoMind, London. Paste the full job description here — it is what the tailored CV is written against.',
    'First application migrated from the JobHunt CV_CoMind folder. Attach CV_CoMind.pdf via the Applications page.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO application_events (application_id, event_type, detail, occurred_at)
VALUES (
    'aaaa0000-0000-4000-8000-000000000001',
    'status_change',
    'Applied via LinkedIn',
    '2026-07-01T09:00:00Z'
);
-- #endregion
