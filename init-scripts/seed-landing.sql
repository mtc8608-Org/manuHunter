-- ════════════════════════════════════════════════════════════════════════════
--  seed-landing.sql
--
--  Minimal placeholder landing page:
--    content_menu
--      landing
--        welcome_card
-- ════════════════════════════════════════════════════════════════════════════

-- ── Base content nodes ───────────────────────────────────────────────────────

INSERT INTO components (id, name, type, data, options) VALUES
  ('00000000-0000-0000-0000-000000000001', 'content_menu', 'contentPage', '{"title": "Content"}', '{}'),
  ('00000000-0000-0000-0000-000000000002', 'landing',      'contentPage', '{"text": "Welcome"}',  '{}'),
  ('00000000-0000-0000-0000-000000000003', 'welcome_card', 'contentHtml', '{"html": ""}',         '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO components_relationships (parent_id, child_id, position) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 0),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 0)
ON CONFLICT DO NOTHING;


-- ── Welcome card ─────────────────────────────────────────────────────────────

UPDATE components SET data = '{
  "html": "<h2>Welcome to manuHunter</h2><p>This is a placeholder landing page. manuHunter is a full-stack job-hunting and CV-building application built on the ManuSpine framework. Content lives in the database and can be edited from the Backoffice — replace this card to make it your own.</p>"
}' WHERE name = 'welcome_card';
