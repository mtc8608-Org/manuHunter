-- ════════════════════════════════════════════════════════════════════════════
--  03-init-cv.sql — LaTeX CV builder domain (manuHunter): schema + framework seed
--
--  A CV is a tree of typed nodes, mirroring the content component tree but kept
--  fully separate (like the survey system). A Node-side assembler walks the tree
--  and emits one .tex string; the Python service compiles it to a PDF.
--
--    cv_components                 — the tree nodes (per-user; owner_id)
--    cv_components_relationships   — ordered parent/child edges
--    cv_artifacts                  — the user-facing record of a generated PDF
--
--  Node types (stored in cv_components.type):
--    cvTemplate     — shared boilerplate: preamble, header, doc open/close
--    cvDocument     — the root assembly: identity values + template_id
--    cvSection      — generic section: title, optional body, typed children
--    cvTextRow      — labelled paragraph line (Core Skills style)
--    cvEntry        — timed bullet block (experience | education | project)
--    cvPublication  — numbered citation
--
--  THIS FILE holds only the reusable framework layer that is safe to commit:
--    · the tables
--    · the FormRenderer edit forms (cf00 range, in the shared `components` table)
--    · the default, generic cvTemplate (LaTeX boilerplate — no personal data)
--
--  The sample CV library and the sample documents (which contain personal data —
--  name, contacts, real CV content) live in the SEPARATE, GITIGNORED seed file
--  init-scripts/seed-cv-samples.sql. Postgres runs seed-*.sql after the numbered
--  NN-init-*.sql files (alphabetical), so that seed applies after this schema.
--
--  Ownership: owner_id NULL means a shared/global node (the default template).
--  Non-NULL means owned by that user. Sample nodes are re-stamped to the admin
--  user at Node startup (backend.js), because the admin row does not exist yet
--  when init scripts run on a fresh volume.
--
--  Runs after 01-init-db.sql and 02-init-jobs.sql (alphabetical), so the users
--  and files tables it references already exist.
-- ════════════════════════════════════════════════════════════════════════════


-- #region Tables
CREATE TABLE cv_components (
    id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name     VARCHAR(255) NOT NULL UNIQUE,
    type     VARCHAR(50),
    data     JSONB,
    options  JSONB,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE   -- NULL = global/shared node
);

CREATE TABLE cv_components_relationships (
    parent_id UUID,
    child_id  UUID,
    position  INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_cv_parent FOREIGN KEY (parent_id) REFERENCES cv_components (id) ON DELETE CASCADE,
    CONSTRAINT fk_cv_child  FOREIGN KEY (child_id)  REFERENCES cv_components (id) ON DELETE CASCADE,
    PRIMARY KEY (parent_id, child_id)
);

-- The user-facing record of a compiled CV PDF (the manuBeat "model run" analogy:
-- a run produces a file plus a domain record). The PDF itself lives in the generic
-- files table + MinIO; the source CV link lives here, never on files.
CREATE TABLE cv_artifacts (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    cv_component_id  UUID        REFERENCES cv_components(id) ON DELETE SET NULL,
    file_id          UUID        REFERENCES files(id)        ON DELETE CASCADE,
    owner_id         UUID        REFERENCES users(id)        ON DELETE CASCADE,
    label            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- The per-user profile lives in the framework user_profile table
-- (01-init-db.sql); this app defines its shape via form_user_profile below.

CREATE INDEX idx_cv_components_owner ON cv_components(owner_id);
CREATE INDEX idx_cv_artifacts_owner  ON cv_artifacts(owner_id);
-- #endregion


-- #region Edit forms · cf00 range (live in the shared `components` table, global)
-- One FormRenderer-compatible form tree per CV node type, plus the user profile form.
-- Field keys (options.label) are the node's own data keys, since TreeEditor passes
-- node.data as defaultValues and saves the form output back as data.
-- UUIDs are hardcoded in constants.ts (CV_EDITOR_ID / CV_FORM).

-- cvSection editor
INSERT INTO components (id, name, type, data, options) VALUES
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf00', 'form_cv_section', 'form',     '{"text": "Section"}',      '{"label": "form_cv_section"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf01', 'cv_sec_title',    'input',    '{"text": "Title"}',        '{"label": "title"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf02', 'cv_sec_body',     'textarea', '{"text": "Body (LaTeX, text sections only)"}', '{"label": "body"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf03', 'cv_sec_layout',   'input',    '{"text": "Layout override (textrows | entries | publications)"}', '{"label": "layout"}');
INSERT INTO components_relationships (parent_id, child_id, position) VALUES
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf00', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf01', 1),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf00', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf02', 2),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf00', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf03', 3);

-- cvTextRow editor
INSERT INTO components (id, name, type, data, options) VALUES
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf10', 'form_cv_textrow', 'form',     '{"text": "Text Row"}',  '{"label": "form_cv_textrow"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf11', 'cv_row_label',    'input',    '{"text": "Label (optional, rendered bold)"}', '{"label": "label"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf12', 'cv_row_text',     'textarea', '{"text": "Text (LaTeX)"}', '{"label": "text"}');
INSERT INTO components_relationships (parent_id, child_id, position) VALUES
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf10', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf11', 1),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf10', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf12', 2);

-- cvEntry editor (kind is a select; bullets is a `lines` field → string[])
INSERT INTO components (id, name, type, data, options) VALUES
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf20', 'form_cv_entry',    'form',   '{"text": "Entry"}',       '{"label": "form_cv_entry"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf21', 'cv_ent_title',     'input',  '{"text": "Title"}',       '{"label": "title"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf22', 'cv_ent_org',       'input',  '{"text": "Organisation (or description, for projects)"}', '{"label": "org"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf23', 'cv_ent_location',  'input',  '{"text": "Location"}',    '{"label": "location"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf24', 'cv_ent_dates',     'input',  '{"text": "Dates"}',       '{"label": "dates"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf25', 'cv_ent_kind',      'select', '{"text": "Kind"}',        '{"label": "kind"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf26', 'cv_ent_kind_exp',  'option', '{"text": "experience"}',  '{"label": "experience"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf27', 'cv_ent_kind_edu',  'option', '{"text": "education"}',   '{"label": "education"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf28', 'cv_ent_kind_proj', 'option', '{"text": "project"}',     '{"label": "project"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf29', 'cv_ent_bullets',   'lines',  '{"text": "Bullets (one per line)"}', '{"label": "bullets"}');
INSERT INTO components_relationships (parent_id, child_id, position) VALUES
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf20', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf21', 1),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf20', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf22', 2),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf20', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf23', 3),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf20', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf24', 4),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf20', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf25', 5),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf25', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf26', 1),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf25', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf27', 2),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf25', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf28', 3),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf20', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf29', 6);

-- cvPublication editor
INSERT INTO components (id, name, type, data, options) VALUES
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf30', 'form_cv_publication', 'form',     '{"text": "Publication"}', '{"label": "form_cv_publication"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf31', 'cv_pub_authors',      'input',    '{"text": "Authors"}',     '{"label": "authors"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf32', 'cv_pub_title',        'input',    '{"text": "Title"}',       '{"label": "title"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf33', 'cv_pub_venue',        'input',    '{"text": "Venue"}',       '{"label": "venue"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf34', 'cv_pub_year',         'input',    '{"text": "Year"}',        '{"label": "year"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf35', 'cv_pub_raw',          'textarea', '{"text": "Raw override (full LaTeX \\item body, optional)"}', '{"label": "raw"}');
INSERT INTO components_relationships (parent_id, child_id, position) VALUES
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf30', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf31', 1),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf30', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf32', 2),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf30', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf33', 3),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf30', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf34', 4),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf30', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf35', 5);

-- cvTemplate editor — the shared LaTeX boilerplate. A name for the picker, then
-- the raw blobs. Owner scopes it: users edit their own, the global default is
-- read-only to non-admins (clone it to start).
INSERT INTO components (id, name, type, data, options) VALUES
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf40', 'form_cv_template', 'form',     '{"text": "Template"}',    '{"label": "form_cv_template"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf45', 'cv_tpl_name',      'input',    '{"text": "Template name"}', '{"label": "name"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf41', 'cv_tpl_preamble',  'code', '{"text": "Preamble (LaTeX up to begin document)"}', '{"label": "preamble", "language": "latex"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf42', 'cv_tpl_header',    'code', '{"text": "Header (identity block)"}', '{"label": "header", "language": "latex"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf43', 'cv_tpl_docopen',   'code',     '{"text": "Doc open"}',    '{"label": "docOpen", "language": "latex"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf44', 'cv_tpl_docclose',  'code',     '{"text": "Doc close"}',   '{"label": "docClose", "language": "latex"}');
INSERT INTO components_relationships (parent_id, child_id, position) VALUES
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf40', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf45', 1),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf40', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf41', 2),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf40', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf42', 3),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf40', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf43', 4),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf40', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf44', 5);

-- cvDocument editor — only the per-CV fields (identity lives on the user profile
-- below). A CV = a name (title), a tailored tagline, and a chosen template.
INSERT INTO components (id, name, type, data, options) VALUES
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf50', 'form_cv_document',    'form',  '{"text": "CV Details"}',    '{"label": "form_cv_document"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf51', 'cv_doc_title',        'input', '{"text": "CV name"}',       '{"label": "title"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf54', 'cv_doc_tagline',      'input', '{"text": "Tagline"}',       '{"label": "tagline"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf5a', 'cv_doc_template_id',  'input', '{"text": "Template id"}',   '{"label": "template_id"}');
INSERT INTO components_relationships (parent_id, child_id, position) VALUES
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf50', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf51',  1),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf50', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf54',  2),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf50', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf5a',  3);

-- User profile editor — the per-user profile block, saved via upsertUserProfile
-- and merged into every CV at compile time. Field keys match user_profile.data
-- (cvAssemble reads explicit keys only, so extra fields like picture are ignored).
INSERT INTO components (id, name, type, data, options) VALUES
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf60', 'form_user_profile',     'form',       '{"text": "Profile"}',        '{"label": "form_user_profile"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf61', 'user_prof_name',        'input',      '{"text": "Full name"}',      '{"label": "name"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf62', 'user_prof_phone',       'input',      '{"text": "Phone"}',          '{"label": "phone"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf63', 'user_prof_email',       'input',      '{"text": "Email"}',          '{"label": "email"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf64', 'user_prof_location',    'input',      '{"text": "Location"}',       '{"label": "location"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf65', 'user_prof_linkedin_url','input',      '{"text": "LinkedIn URL"}',   '{"label": "linkedin_url"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf66', 'user_prof_linkedin_lbl','input',      '{"text": "LinkedIn label"}', '{"label": "linkedin_label"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf67', 'user_prof_github_url',  'input',      '{"text": "GitHub URL"}',     '{"label": "github_url"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf68', 'user_prof_github_lbl',  'input',      '{"text": "GitHub label"}',   '{"label": "github_label"}'),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf69', 'user_prof_picture',     'filepicker', '{"text": "Profile picture"}','{"label": "picture"}');
INSERT INTO components_relationships (parent_id, child_id, position) VALUES
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf60', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf61', 1),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf60', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf62', 2),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf60', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf63', 3),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf60', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf64', 4),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf60', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf65', 5),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf60', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf66', 6),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf60', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf67', 7),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf60', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf68', 8),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97cf60', 'c51c1e5f-5cc1-4b77-8832-2d10cc97cf69', 9);
-- #endregion


-- #region Shared template · c000 (owner_id NULL → global; generic, no personal data)
-- Preamble + macros copied verbatim from the shared preamble both sample CVs use
-- (CV_CoMind.tex:7-80 / CVquant.tex:5-78). The identity \newcommand block is emitted
-- by the assembler from cvDocument.data; the header below references those macros.
INSERT INTO cv_components (id, name, type, data, owner_id) VALUES
('c51c1e5f-5cc1-4b77-8832-2d10cc97c000', 'cv_template_default', 'cvTemplate',
 jsonb_build_object(
   'name', 'Default',
   'preamble', $latex$\documentclass[a4paper,11pt]{article}
\usepackage{latexsym}
\usepackage{xcolor}
\usepackage{float}
\usepackage{ragged2e}
\usepackage[empty]{fullpage}
\usepackage{wrapfig}
\usepackage{tabularx}
\usepackage{titlesec}
\usepackage{geometry}
\usepackage{marvosym}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage{fontawesome5}
\usepackage{multicol}
\usepackage{graphicx}
\usepackage{cfr-lm}
\usepackage[T1]{fontenc}
\setlength{\multicolsep}{0pt}
\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}
\geometry{left=1.4cm, top=0.8cm, right=1.2cm, bottom=1cm}

\usepackage[most]{tcolorbox}
\tcbset{
	frame code={},
	center title,
	left=0pt,
	right=0pt,
	top=0pt,
	bottom=0pt,
	colback=gray!20,
	colframe=white,
	width=\dimexpr\textwidth\relax,
	enlarge left by=-2mm,
	boxsep=4pt,
	arc=0pt,outer arc=0pt,
}

\urlstyle{same}
\raggedright
\setlength{\tabcolsep}{0in}

\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-7pt}]

% Custom commands
\newcommand{\resumeSubheading}[4]{
\vspace{0.5mm}\item
\begin{tabular*}{0.98\textwidth}[t]{l@{\extracolsep{\fill}}r}
\textbf{#1} & \textit{\footnotesize{#4}} \\
\textit{\footnotesize{#3}} & \footnotesize{#2} \\
\end{tabular*}
\vspace{-2.4mm}
}

\newcommand{\resumeProject}[4]{
\vspace{0.5mm}\item
\begin{tabular*}{0.98\textwidth}[t]{l@{\extracolsep{\fill}}r}
\textbf{#1} & \textit{\footnotesize{#3}} \\
\footnotesize{\textit{#2}} & \footnotesize{#4}
\end{tabular*}
\vspace{-2.4mm}
}

\renewcommand{\labelitemi}{$\vcenter{\hbox{\tiny$\bullet$}}$}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=*,labelsep=0mm]}
\newcommand{\resumeItemListStart}{\begin{justify}\begin{itemize}[leftmargin=3ex, rightmargin=2ex, noitemsep,labelsep=1.2mm]\small}
\newcommand{\resumeItemListEnd}{\end{itemize}\end{justify}\vspace{-2mm}}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}\vspace{2mm}}
\newcolumntype{L}{>{\raggedright\arraybackslash}X}$latex$,
   'header', $latex$\begin{tabularx}{\linewidth}{L r}
\textbf{\Large \name} & {\footnotesize \faPhone\ \phone} \\
\tagline &
\href{mailto:\emaila}{{\footnotesize \faEnvelope}\ \emaila} \\
\locationx &
\href{\linkedinurl}{{\footnotesize \faLinkedin}\ \linkedinlabel} \\
&
\href{\githuburl}{{\footnotesize \faGithub}\ \githublabel}
\end{tabularx}$latex$,
   'docOpen',  E'\\begin{document}\n\\fontfamily{cmr}\\selectfont',
   'docClose', $latex$\end{document}$latex$
 ), NULL);
-- #endregion


-- The sample CV library and the two sample documents (personal data) are seeded
-- separately in the GITIGNORED init-scripts/seed-cv-samples.sql.
