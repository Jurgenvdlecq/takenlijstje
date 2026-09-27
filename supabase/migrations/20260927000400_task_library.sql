-- =============================================================================
-- Standaard huishoudelijke taken (globale bibliotheek, household_id = null)
-- Gebruikers kiezen zelf welke ze activeren (onboarding of Instellingen).
-- default_rule: {"freq": daily|weekly|monthly|yearly, "interval": n, "weekdays": [1..7 (ma..zo)], "monthDay": n}
-- =============================================================================

insert into public.task_templates (slug, category, title, duration_minutes, points, default_rule, default_time, icon, keywords, popular, sort_order) values
  -- Schoonmaak
  ('bathroom',        'cleaning', 'Badkamer schoonmaken',     45, 5, '{"freq":"weekly","interval":1,"weekdays":[6]}',    null, '🛁', '{badkamer,douche}', true, 10),
  ('toilet',          'cleaning', 'WC schoonmaken',           15, 3, '{"freq":"weekly","interval":1,"weekdays":[3,7]}',  null, '🚽', '{wc,toilet}', true, 11),
  ('kitchen-clean',   'cleaning', 'Keuken schoonmaken',       30, 3, '{"freq":"weekly","interval":1,"weekdays":[5]}',    null, '🧽', '{keuken}', false, 12),
  ('countertop',      'cleaning', 'Keukenblad schoonmaken',   5,  1, '{"freq":"daily","interval":1}',                    null, '🧼', '{keukenblad,aanrecht}', false, 13),
  ('stove',           'cleaning', 'Kookplaat schoonmaken',    10, 1, '{"freq":"weekly","interval":1,"weekdays":[7]}',    null, '🍳', '{kookplaat,fornuis}', false, 14),
  ('oven',            'cleaning', 'Oven schoonmaken',         30, 3, '{"freq":"monthly","interval":1,"monthDay":1}',     null, '🔥', '{oven}', false, 15),
  ('fridge-clean',    'cleaning', 'Koelkast schoonmaken',     20, 2, '{"freq":"monthly","interval":1,"monthDay":15}',    null, '🧊', '{koelkast}', false, 16),
  ('vacuum',          'cleaning', 'Stofzuigen',               30, 3, '{"freq":"weekly","interval":1,"weekdays":[2,6]}',  null, '🧹', '{stofzuigen,stofzuiger}', true, 17),
  ('mop',             'cleaning', 'Dweilen',                  30, 3, '{"freq":"weekly","interval":1,"weekdays":[6]}',    null, '🪣', '{dweilen,vloer}', true, 18),
  ('dust',            'cleaning', 'Stoffen',                  20, 2, '{"freq":"weekly","interval":1,"weekdays":[4]}',    null, '🪶', '{stoffen,stof}', false, 19),
  ('bedrooms',        'cleaning', 'Slaapkamers schoonmaken',  45, 5, '{"freq":"weekly","interval":2,"weekdays":[6]}',    null, '🛏️', '{slaapkamer,slaapkamers}', false, 20),
  ('change-bed',      'cleaning', 'Bed verschonen',           15, 2, '{"freq":"weekly","interval":2,"weekdays":[7]}',    null, '🛌', '{bed,verschonen,lakens}', true, 21),
  ('windows',         'cleaning', 'Ramen wassen',             60, 6, '{"freq":"monthly","interval":1,"monthDay":1}',     null, '🪟', '{ramen,raam}', false, 22),
  ('stairs',          'cleaning', 'Trap stofzuigen',          15, 2, '{"freq":"weekly","interval":1,"weekdays":[6]}',    null, '🪜', '{trap}', false, 23),
  ('bins',            'cleaning', 'Prullenbakken legen',      10, 1, '{"freq":"weekly","interval":1,"weekdays":[1,4]}',  null, '🗑️', '{prullenbak,prullenbakken,vuilnis}', false, 24),
  -- Was
  ('laundry-collect', 'laundry',  'Was verzamelen',           5,  1, '{"freq":"weekly","interval":1,"weekdays":[1,4]}',  null, '🧺', '{was,verzamelen}', false, 30),
  ('laundry-start',   'laundry',  'Wasmachine aanzetten',     5,  1, '{"freq":"weekly","interval":1,"weekdays":[1,4]}',  null, '🫧', '{wasmachine,wassen}', true, 31),
  ('laundry-hang',    'laundry',  'Was ophangen',             15, 2, '{"freq":"weekly","interval":1,"weekdays":[1,4]}',  null, '👕', '{ophangen}', false, 32),
  ('laundry-dryer',   'laundry',  'Was in droger doen',       5,  1, '{"freq":"weekly","interval":1,"weekdays":[1,4]}',  null, '🌀', '{droger}', false, 33),
  ('laundry-fold',    'laundry',  'Was opvouwen',             20, 2, '{"freq":"weekly","interval":1,"weekdays":[2,5]}',  null, '👚', '{opvouwen,vouwen}', false, 34),
  ('laundry-away',    'laundry',  'Was opruimen',             10, 1, '{"freq":"weekly","interval":1,"weekdays":[2,5]}',  null, '🗄️', '{opruimen}', false, 35),
  ('bedding-wash',    'laundry',  'Beddengoed wassen',        10, 1, '{"freq":"weekly","interval":2,"weekdays":[7]}',    null, '🛏️', '{beddengoed}', false, 36),
  ('towels-wash',     'laundry',  'Handdoeken wassen',        10, 1, '{"freq":"weekly","interval":1,"weekdays":[3]}',    null, '🧖', '{handdoeken,handdoek}', false, 37),
  -- Boodschappen
  ('grocery-list',    'groceries','Boodschappenlijst maken',  10, 1, '{"freq":"weekly","interval":1,"weekdays":[5]}',    '18:00', '📝', '{boodschappenlijst,lijst}', true, 40),
  ('stock-check',     'groceries','Voorraad controleren',     10, 1, '{"freq":"weekly","interval":1,"weekdays":[5]}',    null, '📦', '{voorraad}', false, 41),
  ('groceries',       'groceries','Boodschappen doen',        60, 4, '{"freq":"weekly","interval":1,"weekdays":[6]}',    '10:00', '🛒', '{boodschappen,winkel,supermarkt}', true, 42),
  ('groceries-away',  'groceries','Boodschappen opruimen',    10, 1, '{"freq":"weekly","interval":1,"weekdays":[6]}',    '11:30', '🥫', '{opruimen}', false, 43),
  -- Keuken
  ('dishwasher-load', 'kitchen',  'Vaatwasser inruimen',      10, 1, '{"freq":"daily","interval":1}',                    null, '🍽️', '{vaatwasser,inruimen}', true, 50),
  ('dishwasher-empty','kitchen',  'Vaatwasser uitruimen',     10, 1, '{"freq":"daily","interval":1}',                    null, '🍽️', '{vaatwasser,uitruimen}', true, 51),
  ('dishes',          'kitchen',  'Afwas doen',               20, 2, '{"freq":"daily","interval":1}',                    null, '🧽', '{afwas,afwassen}', false, 52),
  ('fridge-check',    'kitchen',  'Koelkast controleren',     5,  1, '{"freq":"weekly","interval":1,"weekdays":[5]}',    null, '🧊', '{koelkast}', false, 53),
  ('expiry-check',    'kitchen',  'Houdbaarheidsdata controleren', 10, 1, '{"freq":"weekly","interval":2,"weekdays":[5]}', null, '📅', '{houdbaarheid,datum}', false, 54),
  -- Buiten
  ('garden-tidy',     'outdoor',  'Tuin opruimen',            45, 5, '{"freq":"weekly","interval":2,"weekdays":[6]}',    null, '🌿', '{tuin}', false, 60),
  ('mow',             'outdoor',  'Gras maaien',              45, 5, '{"freq":"weekly","interval":1,"weekdays":[6]}',    null, '🌱', '{gras,maaien,grasmaaier}', false, 61),
  ('water-plants',    'outdoor',  'Planten water geven',      10, 1, '{"freq":"weekly","interval":1,"weekdays":[3,7]}',  null, '🪴', '{planten,water}', false, 62),
  ('bin-out',         'outdoor',  'Afvalcontainer buiten zetten', 5, 1, '{"freq":"weekly","interval":1,"weekdays":[2]}', '20:00', '♻️', '{afval,container,kliko,buiten}', true, 63),
  ('bin-in',          'outdoor',  'Afvalcontainer binnenhalen', 5, 1, '{"freq":"weekly","interval":1,"weekdays":[3]}',   '18:00', '♻️', '{binnenhalen,kliko}', false, 64),
  -- Overige
  ('paperwork',       'admin',    'Administratie',            30, 3, '{"freq":"weekly","interval":1,"weekdays":[7]}',    null, '📂', '{administratie,rekeningen}', false, 70),
  ('pets',            'pets',     'Huisdieren verzorgen',     15, 2, '{"freq":"daily","interval":1}',                    null, '🐾', '{huisdier,huisdieren,hond,kat,voeren}', false, 71),
  ('pharmacy',        'other',    'Medicijnen/apotheek ophalen', 20, 2, '{"freq":"monthly","interval":1,"monthDay":1}',  null, '💊', '{apotheek,medicijnen}', false, 72),
  ('mail',            'admin',    'Post verwerken',           10, 1, '{"freq":"weekly","interval":1,"weekdays":[3]}',    null, '✉️', '{post,brieven}', false, 73),
  ('supplies-check',  'other',    'Voorraad huishoudelijke spullen controleren', 10, 1, '{"freq":"weekly","interval":2,"weekdays":[5]}', null, '🧴', '{schoonmaakmiddel,voorraad}', false, 74)
on conflict do nothing;
