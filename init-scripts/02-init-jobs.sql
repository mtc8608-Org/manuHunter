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


-- #region Edit forms · FormRenderer trees (global, in the shared `components` table)
-- Field keys (options.label) match the writable application / event columns, so
-- FormRenderer output maps straight onto create/updateApplication + addApplicationEvent.
-- UUIDs hardcoded in constants.ts (APP_FORM).
INSERT INTO components (id, name, type, data, options) VALUES
  ('aaaaf001-0000-4000-8000-000000000001', 'form_application', 'form',   '{"text": "Application"}',     '{"label": "form_application"}'),
  ('aaaaf001-0000-4000-8000-000000000002', 'app_company',      'input',  '{"text": "Company"}',         '{"label": "company"}'),
  ('aaaaf001-0000-4000-8000-000000000003', 'app_role',         'input',  '{"text": "Role"}',            '{"label": "role"}'),
  ('aaaaf001-0000-4000-8000-000000000004', 'app_location',     'input',  '{"text": "Location"}',        '{"label": "location"}'),
  ('aaaaf001-0000-4000-8000-000000000005', 'app_source',       'input',  '{"text": "Source"}',          '{"label": "source"}'),
  ('aaaaf001-0000-4000-8000-000000000006', 'app_job_url',      'input',  '{"text": "Job URL"}',         '{"label": "job_url"}'),
  ('aaaaf001-0000-4000-8000-000000000007', 'app_status',       'select', '{"text": "Status"}',          '{"label": "status"}'),
  ('aaaaf001-0000-4000-8000-000000000008', 'app_salary',       'input',  '{"text": "Salary"}',          '{"label": "salary"}'),
  ('aaaaf001-0000-4000-8000-000000000009', 'app_contact',      'input',  '{"text": "Contact"}',         '{"label": "contact"}'),
  ('aaaaf001-0000-4000-8000-00000000000a', 'app_applied_at',   'date',   '{"text": "Applied date"}',    '{"label": "applied_at"}'),
  ('aaaaf001-0000-4000-8000-00000000000b', 'app_job_desc',     'textarea','{"text": "Job description"}', '{"label": "job_description"}'),
  ('aaaaf001-0000-4000-8000-00000000000c', 'app_notes',        'textarea','{"text": "Notes"}',           '{"label": "notes"}'),
  ('aaaaf001-0000-4000-8000-000000000010', 'app_st_draft',     'option', '{"text": "draft"}',           '{"label": "draft"}'),
  ('aaaaf001-0000-4000-8000-000000000011', 'app_st_applied',   'option', '{"text": "applied"}',         '{"label": "applied"}'),
  ('aaaaf001-0000-4000-8000-000000000012', 'app_st_screening', 'option', '{"text": "screening"}',       '{"label": "screening"}'),
  ('aaaaf001-0000-4000-8000-000000000013', 'app_st_interview', 'option', '{"text": "interview"}',       '{"label": "interview"}'),
  ('aaaaf001-0000-4000-8000-000000000014', 'app_st_offer',     'option', '{"text": "offer"}',           '{"label": "offer"}'),
  ('aaaaf001-0000-4000-8000-000000000015', 'app_st_rejected',  'option', '{"text": "rejected"}',        '{"label": "rejected"}'),
  ('aaaaf001-0000-4000-8000-000000000016', 'app_st_ghosted',   'option', '{"text": "ghosted"}',         '{"label": "ghosted"}'),
  ('aaaaf001-0000-4000-8000-000000000017', 'app_st_withdrawn', 'option', '{"text": "withdrawn"}',       '{"label": "withdrawn"}');
INSERT INTO components_relationships (parent_id, child_id, position) VALUES
  ('aaaaf001-0000-4000-8000-000000000001', 'aaaaf001-0000-4000-8000-000000000002',  1),
  ('aaaaf001-0000-4000-8000-000000000001', 'aaaaf001-0000-4000-8000-000000000003',  2),
  ('aaaaf001-0000-4000-8000-000000000001', 'aaaaf001-0000-4000-8000-000000000004',  3),
  ('aaaaf001-0000-4000-8000-000000000001', 'aaaaf001-0000-4000-8000-000000000005',  4),
  ('aaaaf001-0000-4000-8000-000000000001', 'aaaaf001-0000-4000-8000-000000000006',  5),
  ('aaaaf001-0000-4000-8000-000000000001', 'aaaaf001-0000-4000-8000-000000000007',  6),
  ('aaaaf001-0000-4000-8000-000000000001', 'aaaaf001-0000-4000-8000-000000000008',  7),
  ('aaaaf001-0000-4000-8000-000000000001', 'aaaaf001-0000-4000-8000-000000000009',  8),
  ('aaaaf001-0000-4000-8000-000000000001', 'aaaaf001-0000-4000-8000-00000000000a',  9),
  ('aaaaf001-0000-4000-8000-000000000001', 'aaaaf001-0000-4000-8000-00000000000b', 10),
  ('aaaaf001-0000-4000-8000-000000000001', 'aaaaf001-0000-4000-8000-00000000000c', 11),
  ('aaaaf001-0000-4000-8000-000000000007', 'aaaaf001-0000-4000-8000-000000000010',  1),
  ('aaaaf001-0000-4000-8000-000000000007', 'aaaaf001-0000-4000-8000-000000000011',  2),
  ('aaaaf001-0000-4000-8000-000000000007', 'aaaaf001-0000-4000-8000-000000000012',  3),
  ('aaaaf001-0000-4000-8000-000000000007', 'aaaaf001-0000-4000-8000-000000000013',  4),
  ('aaaaf001-0000-4000-8000-000000000007', 'aaaaf001-0000-4000-8000-000000000014',  5),
  ('aaaaf001-0000-4000-8000-000000000007', 'aaaaf001-0000-4000-8000-000000000015',  6),
  ('aaaaf001-0000-4000-8000-000000000007', 'aaaaf001-0000-4000-8000-000000000016',  7),
  ('aaaaf001-0000-4000-8000-000000000007', 'aaaaf001-0000-4000-8000-000000000017',  8);

INSERT INTO components (id, name, type, data, options) VALUES
  ('aaaaf002-0000-4000-8000-000000000001', 'form_application_event', 'form',   '{"text": "Event"}',   '{"label": "form_application_event"}'),
  ('aaaaf002-0000-4000-8000-000000000002', 'app_ev_type',   'select',   '{"text": "Type"}',   '{"label": "event_type"}'),
  ('aaaaf002-0000-4000-8000-000000000003', 'app_ev_detail', 'textarea', '{"text": "Detail"}', '{"label": "detail"}'),
  ('aaaaf002-0000-4000-8000-000000000010', 'app_ev_response',  'option', '{"text": "Response received"}', '{"label": "response"}'),
  ('aaaaf002-0000-4000-8000-000000000011', 'app_ev_interview', 'option', '{"text": "Interview"}',        '{"label": "interview"}'),
  ('aaaaf002-0000-4000-8000-000000000012', 'app_ev_status',    'option', '{"text": "Status change"}',    '{"label": "status_change"}'),
  ('aaaaf002-0000-4000-8000-000000000013', 'app_ev_note',      'option', '{"text": "Note"}',             '{"label": "note"}');
INSERT INTO components_relationships (parent_id, child_id, position) VALUES
  ('aaaaf002-0000-4000-8000-000000000001', 'aaaaf002-0000-4000-8000-000000000002', 1),
  ('aaaaf002-0000-4000-8000-000000000001', 'aaaaf002-0000-4000-8000-000000000003', 2),
  ('aaaaf002-0000-4000-8000-000000000002', 'aaaaf002-0000-4000-8000-000000000010', 1),
  ('aaaaf002-0000-4000-8000-000000000002', 'aaaaf002-0000-4000-8000-000000000011', 2),
  ('aaaaf002-0000-4000-8000-000000000002', 'aaaaf002-0000-4000-8000-000000000012', 3),
  ('aaaaf002-0000-4000-8000-000000000002', 'aaaaf002-0000-4000-8000-000000000013', 4);
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
