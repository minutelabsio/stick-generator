-- Local dev data. Idempotent: safe to re-run. Never run against remote databases
-- (the dev:init script only ever passes --local).
-- The channels come from scripts/seed-dev-channels.ts, which runs first:
--   ...0c1 is "Original" and ...0c2 is "Sketchbook".

-- The Original channel's palettes, carried over from v1 (src/lib/stick-assets.ts on main).
INSERT INTO palettes (channel_id, id, colors) VALUES
  ('00000000-0000-4000-8000-0000000000c1', 'skin', '["#F5DDCE","#F0C4B8","#D4AD9F","#D4AA78","#B7775D","#895C4A","#67493D","#4F3B33","#FFFFFF"]'),
  ('00000000-0000-4000-8000-0000000000c1', 'hair', '["#FFFFFF","#292929","#333333","#4D4D4D","#666666","#A6A6A6","#CCCCCC","#63503C","#775E46","#99784A","#BC975A","#E1C175","#EDD686","#63403C","#774F46","#9C5D50","#B86B4E","#C87146","#EDA386","#692E59","#813475","#983F8A","#B553A6","#DC69CB","#E883D9","#473764","#574082","#7555B0","#9169DC","#2A4A75","#5077AD","#6999DC","#4A8AAA","#53A6C2","#69D0DC","#56C0A5","#84DBBA","#A2EFD1","#7BC57D","#A2EFA4","#AEC973","#D7EFA2","#D2D066","#F4F38C"]'),
  ('00000000-0000-4000-8000-0000000000c1', 'hat', '["#7CCDEB","#287CED","#E4A718","#F37C21","#DB403F","#F8E15F","#A2D57A","#5A8847","#726557","#C0887F","#F397D2","#CF71E8","#8C60D4","#80807F","#4D4D4C","#E4E4E3","#1A1A1A"]'),
  ('00000000-0000-4000-8000-0000000000c1', 'glasses', '["#7CCDEB","#287CED","#E4A718","#F37C21","#DB403F","#F8E15F","#A2D57A","#5A8847","#726557","#C0887F","#F397D2","#CF71E8","#8C60D4","#80807F","#4D4D4C","#E4E4E3","#1A1A1A","#FCF4F0"]')
ON CONFLICT (channel_id, id) DO UPDATE SET colors = excluded.colors;

-- Sketchbook draws in a muted set, so switching channels visibly changes the swatches.
INSERT INTO palettes (channel_id, id, colors) VALUES
  ('00000000-0000-4000-8000-0000000000c2', 'skin', '["#EFE6DD","#D9C5B2","#B39C86","#8A7563","#5E4E42"]'),
  ('00000000-0000-4000-8000-0000000000c2', 'hair', '["#2B2B2B","#5C5C5C","#8F8F8F","#6B5444","#A8865F","#C9B48A"]'),
  ('00000000-0000-4000-8000-0000000000c2', 'hat', '["#3D5A6C","#7A9E7E","#B5654A","#D9B26F","#2B2B2B"]'),
  ('00000000-0000-4000-8000-0000000000c2', 'glasses', '["#2B2B2B","#5C5C5C","#8A7563","#F4F1EC"]')
ON CONFLICT (channel_id, id) DO UPDATE SET colors = excluded.colors;

INSERT INTO groups (id, channel_id, slug, name, source, questions, join_code, opens_at, closes_at, max_submissions, contact_email) VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c1', 'demo-batch', 'Demo batch', 'intake',
   '[{"id":"hair","label":"Describe your hair","type":"text","required":true,"maxLength":200,"highlight":true},{"id":"hobby","label":"A hobby or favourite thing","type":"text","required":false,"maxLength":200,"highlight":true}]',
   'DEMX-TEST-KEYS', '2026-01-01T00:00:00.000Z', '2030-01-01T00:00:00.000Z', 50, 'team@example.com'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000c2', 'sketchbook-demo', 'Sketchbook demo', 'intake',
   '[{"id":"look","label":"Describe how you look","type":"text","required":true,"maxLength":200,"highlight":true}]',
   'SKCH-TEST-KEYS', '2026-01-01T00:00:00.000Z', '2030-01-01T00:00:00.000Z', 20, 'team@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO entries (id, group_id, name, email, answers, status, submitted_at) VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Ada Example', 'ada@example.com',
   '{"hair":"Short, dark, curly","hobby":"Rock climbing"}', 'new', '2026-09-01T10:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Grace Sample', 'grace@example.com',
   '{"hair":"Long and red","hobby":"Knitting"}', 'in_progress', '2026-09-01T11:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'Alan Placeholder', 'alan@example.com',
   '{"hair":"Bald, big beard","hobby":"Chess"}', 'done', '2026-09-01T12:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000002', 'Mary Draft', 'mary@example.com',
   '{"look":"Grey bob, round glasses"}', 'new', '2026-09-02T10:00:00.000Z')
ON CONFLICT (id) DO NOTHING;
