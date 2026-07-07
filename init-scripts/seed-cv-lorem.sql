-- ════════════════════════════════════════════════════════════════════════════
--  seed-cv-lorem.sql — shared sample "lorem" CV (committed — no personal data)
--
--  A fictional, read-only sample CV visible to every registered user, exercising
--  every CV node type and every section layout the assembler supports:
--    · cvDocument (c300) using the shared default cvTemplate (c000, 03-init-cv.sql)
--    · cvSection in all four layouts: text (body only), textrows (inferred),
--      entries (inferred), publications (explicit data.layout override)
--    · cvTextRow with and without the optional label
--    · cvEntry in all three kinds — experience, education (incl. the
--      empty-bullets head-only branch), project
--    · cvPublication both structured (authors/title/venue/year) and raw override
--
--  All nodes are seeded with owner_id NULL (shared) and names prefixed
--  cv_lorem_ — backend.js's startup admin re-stamp skips that prefix, so these
--  stay globally visible. Writes on NULL-owned nodes are admin-only, so the
--  sample is read-only for users; compile renders it with the caller's own
--  profile (identity block), since a shared document has no owner profile.
--
--  Runs after 03-init-cv.sql (seed-*.sql sorts after NN-init-*.sql), so the
--  tables and the default template already exist. UUID range: ...2d10cc97c3XX.
-- ════════════════════════════════════════════════════════════════════════════


-- #region Sections + leaves (c310 profile, c320 skills, c330 experience,
--         c340 projects, c350 publications, c360 education)
INSERT INTO cv_components (id, name, type, data, owner_id) VALUES
-- text layout: body only, no children
('c51c1e5f-5cc1-4b77-8832-2d10cc97c310', 'cv_lorem_section_profile', 'cvSection',
 jsonb_build_object('title', 'Profile', 'body', $b$Lorem ipsum dolor sit amet, consectetur adipiscing elit, with 10+ years' experience in sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat --- duis aute irure dolor in reprehenderit. Writes production-quality \textit{voluptate velit} and communicates cillum dolore clearly to both technical and non-technical audiences.$b$), NULL),

-- textrows layout (inferred from cvTextRow children)
('c51c1e5f-5cc1-4b77-8832-2d10cc97c320', 'cv_lorem_section_skills', 'cvSection', jsonb_build_object('title', 'Core Skills'), NULL),
('c51c1e5f-5cc1-4b77-8832-2d10cc97c321', 'cv_lorem_skill_domain', 'cvTextRow', jsonb_build_object('label', 'Domain Expertise', 'text', $b$Lorem ipsum, dolor sit amet, consectetur \& adipiscing, eiusmod tempor, incididunt ut labore$b$), NULL),
('c51c1e5f-5cc1-4b77-8832-2d10cc97c322', 'cv_lorem_skill_prog',   'cvTextRow', jsonb_build_object('label', 'Programming', 'text', $b$Ipsum (primary), Dolor, Consectetur, SQL; magna aliqua (ut enim, ad minim), veniam quis$b$), NULL),
('c51c1e5f-5cc1-4b77-8832-2d10cc97c323', 'cv_lorem_skill_lang',   'cvTextRow', jsonb_build_object('label', 'Languages', 'text', $b$Latin (native), English (C2)$b$), NULL),
-- a row without the optional label
('c51c1e5f-5cc1-4b77-8832-2d10cc97c324', 'cv_lorem_skill_extra',  'cvTextRow', jsonb_build_object('text', $b$Excepteur sint occaecat cupidatat non proident: sunt in culpa qui officia deserunt mollit anim id est laborum$b$), NULL),

-- entries layout, kind = experience
('c51c1e5f-5cc1-4b77-8832-2d10cc97c330', 'cv_lorem_section_experience', 'cvSection', jsonb_build_object('title', 'Experience'), NULL),
('c51c1e5f-5cc1-4b77-8832-2d10cc97c331', 'cv_lorem_entry_senior', 'cvEntry',
 jsonb_build_object('title', $b$Senior Ipsum Engineer$b$, 'org', 'Consectetur Labs Ltd', 'location', 'Dolor City', 'dates', '2021 -- Present', 'kind', 'experience',
   'bullets', jsonb_build_array(
     $b$Led sed do eiusmod tempor incididunt across a team of six, delivering ut labore et dolore \textbf{magna aliqua} to production$b$,
     $b$Designed and built a reusable quis-nostrud framework \href{https://example.com}{(\faExternalLink*\ example.com)} adopted by three product teams$b$)), NULL),
('c51c1e5f-5cc1-4b77-8832-2d10cc97c332', 'cv_lorem_entry_junior', 'cvEntry',
 jsonb_build_object('title', 'Ipsum Engineer', 'org', 'Adipiscing GmbH', 'location', 'Elit Town', 'dates', '2017 -- 2021', 'kind', 'experience',
   'bullets', jsonb_build_array(
     $b$Implemented duis aute irure pipelines handling voluptate velit esse cillum at scale$b$,
     $b$Maintained fugiat nulla pariatur services with 99.9\% excepteur availability$b$)), NULL),

-- entries layout, kind = project (org doubles as description, dates optional)
('c51c1e5f-5cc1-4b77-8832-2d10cc97c340', 'cv_lorem_section_projects', 'cvSection', jsonb_build_object('title', 'Selected Projects'), NULL),
('c51c1e5f-5cc1-4b77-8832-2d10cc97c341', 'cv_lorem_entry_project', 'cvEntry',
 jsonb_build_object('title', 'LoremTracker: Open-Source Ipsum Toolkit', 'org', 'Modular sit-amet framework for consectetur analysis and adipiscing visualisation', 'location', '', 'dates', '2020', 'kind', 'project',
   'bullets', jsonb_build_array(
     $b$Implemented tempor incididunt strategies to fit ut labore parameters to sparse dolore observations$b$,
     $b$Applied the framework to scenarios including magna aliqua and ad minim veniam$b$)), NULL),

-- publications layout (explicit data.layout override) with a body intro
('c51c1e5f-5cc1-4b77-8832-2d10cc97c350', 'cv_lorem_section_publications', 'cvSection',
 jsonb_build_object('title', 'Publications', 'layout', 'publications',
   'body', $b$\textit{Named author on 12+ peer-reviewed lorem publications; first-author items listed below.}$b$), NULL),
-- structured fields (authors / title / venue / year)
('c51c1e5f-5cc1-4b77-8832-2d10cc97c351', 'cv_lorem_pub_structured', 'cvPublication',
 jsonb_build_object('authors', 'Ipsum L, Dolor S, Amet C.', 'title', 'On the asymptotic behaviour of consectetur adipiscing systems.', 'venue', 'Journal of Applied Loremology', 'year', '2023'), NULL),
-- raw override (full \item body)
('c51c1e5f-5cc1-4b77-8832-2d10cc97c352', 'cv_lorem_pub_raw', 'cvPublication',
 jsonb_build_object('raw', $b$\textbf{Ipsum L}, Tempor E. \textit{Sed do eiusmod: a longitudinal study of incididunt ut labore.} Proc.\ Intl.\ Conf.\ on Magna Aliqua, 2021.$b$), NULL),

-- entries layout, kind = education (second entry exercises empty bullets)
('c51c1e5f-5cc1-4b77-8832-2d10cc97c360', 'cv_lorem_section_education', 'cvSection', jsonb_build_object('title', 'Education'), NULL),
('c51c1e5f-5cc1-4b77-8832-2d10cc97c361', 'cv_lorem_entry_edu_phd', 'cvEntry',
 jsonb_build_object('title', $b$PhD, Computational Loremology$b$, 'org', 'University of Ipsum', 'location', '', 'dates', '2013 -- 2017', 'kind', 'education',
   'bullets', jsonb_build_array($b$Thesis: ``Ut enim ad minim veniam: quis nostrud exercitation in coupled ullamco systems''$b$)), NULL),
('c51c1e5f-5cc1-4b77-8832-2d10cc97c362', 'cv_lorem_entry_edu_msc', 'cvEntry',
 jsonb_build_object('title', $b$MSc, Dolor Engineering$b$, 'org', 'University of Ipsum', 'location', '', 'dates', '2008 -- 2013', 'kind', 'education', 'bullets', jsonb_build_array()), NULL);
-- #endregion


-- #region Document root · c300 (title + tagline + the shared default template)
INSERT INTO cv_components (id, name, type, data, owner_id) VALUES
('c51c1e5f-5cc1-4b77-8832-2d10cc97c300', 'cv_lorem_document', 'cvDocument',
 jsonb_build_object(
   'title', 'Sample CV (Lorem)',
   'tagline', $b$Senior Ipsum Engineer: Dolor, Consectetur \& Adipiscing$b$,
   'template_id', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c000'), NULL);
-- #endregion


-- #region Relationships · section children + document assembly
INSERT INTO cv_components_relationships (parent_id, child_id, position) VALUES
  -- Core Skills rows
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c320', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c321', 1),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c320', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c322', 2),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c320', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c323', 3),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c320', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c324', 4),
  -- Experience entries
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c330', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c331', 1),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c330', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c332', 2),
  -- Projects
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c340', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c341', 1),
  -- Publications
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c350', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c351', 1),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c350', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c352', 2),
  -- Education entries
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c360', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c361', 1),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c360', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c362', 2),
  -- Document assembly
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c300', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c310', 1),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c300', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c320', 2),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c300', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c330', 3),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c300', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c340', 4),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c300', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c350', 5),
  ('c51c1e5f-5cc1-4b77-8832-2d10cc97c300', 'c51c1e5f-5cc1-4b77-8832-2d10cc97c360', 6);
-- #endregion
