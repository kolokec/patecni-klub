-- ============================================================
-- Páteční klub – jednorázový seed dat
-- Spustit v Supabase SQL editoru PO schema.sql.
-- Zdroj: podklady-hry.md a podklady-clenove-a-kalendar.md
-- ============================================================

-- ---------- Členové ----------

insert into members (slug, display_name, initial, login_email, is_admin, hue, sort_order, host_question) values
  ('s', 'Silvie', 'S', 's@patecni-klub.example', true,  32,  1, 'Kolik máme oranžových koček?'),
  ('m', 'Marek',  'M', 'm@patecni-klub.example', false, 190, 2, null),
  ('z', 'Zbyněk', 'Z', 'z@patecni-klub.example', false, 330, 3, null);

insert into member_host_secrets (member_id, host_answer)
select id, '1' from members where slug = 's';

-- ---------- Hry ----------

insert into games (name, min_players, max_players, image_path) values
  ('Azul',                             2, 4,  'assets/games/azul.png'),
  ('Quartino',                         2, 4,  'assets/games/quartino.png'),
  ('Genius Square',                    1, 2,  'assets/games/genius-square.png'),
  ('Munchkin',                         3, 6,  'assets/games/munchkin.png'),
  ('Bájné kostky',                     3, 6,  'assets/games/bajne-kostky.png'),
  ('Krycí jména',                      2, 8,  'assets/games/kryci-jmena.png'),
  ('Krycí jména – Obrázky',            2, 8,  'assets/games/kryci-jmena-obrazky.png'),
  ('Vydry',                            3, 5,  'assets/games/vydry.png'),
  ('Flip 7',                           3, 18, 'assets/games/flip-7.png'),
  ('Podělaná smůla',                   3, 7,  'assets/games/podelana-smula.png'),
  ('Trio',                             3, 6,  'assets/games/trio.png'),
  ('The Mind',                         2, 4,  'assets/games/the-mind.png'),
  ('Pirátské kostky',                  2, 5,  'assets/games/piratske-kostky.png'),
  ('Codex Naturalis',                  2, 4,  'assets/games/codex-naturalis.png'),
  ('Osmero',                           2, 6,  'assets/games/osmero.png'),
  ('U mě dobrý',                       2, 5,  'assets/games/u-me-dobry.png'),
  ('All in',                           2, 5,  'assets/games/all-in.png'),
  ('Ovce v masce',                     2, 6,  'assets/games/ovce-v-masce.png'),
  ('Naiši',                            2, 2,  'assets/games/naishi.png'),
  ('Word Bits',                        2, 6,  'assets/games/word-bits.png'),
  ('Jungo',                            3, 5,  'assets/games/jungo.png'),
  ('6 bere! Baron Vůl',                2, 10, 'assets/games/6-bere-baron-vul.png'),
  ('Zlato nebo život',                 2, 2,  'assets/games/zlato-nebo-zivot.png'),
  ('Ztracená města',                   2, 2,  'assets/games/ztracena-mesta.png'),
  ('Monopoly',                         2, 6,  'assets/games/monopoly.png'),
  ('Othello na cesty',                 2, 2,  'assets/games/othello-na-cesty.png'),
  ('Bang!',                            4, 7,  'assets/games/bang.png'),
  ('Město duchů Bang!',                3, 8,  'assets/games/bang-mesto-duchu.png'),
  ('Canasta The Simpsons',             1, 99, 'assets/games/canasta-simpsons.png'),
  ('Canasta Gothic',                   1, 99, 'assets/games/canasta-gothic.png'),
  ('echoes KOKTEJL',                   1, 6,  'assets/games/echoes-koktejl.png'),
  ('70tá léta – Kvízy do kapsy',       1, 6,  'assets/games/70ta-leta-kvizy.png'),
  ('1%',                               2, 6,  'assets/games/jedno-procento.png'),
  ('Atol',                             1, 4,  'assets/games/atol.png'),
  ('Bossin'' Space',                   1, 5,  'assets/games/bossin-space.png'),
  ('Dej sem totem',                    2, 2,  'assets/games/dej-sem-totem.png'),
  ('Endless Winter: Paleoamericans',   1, 4,  'assets/games/endless-winter-paleoamericans.png'),
  ('Endless Winter: Ancestors',        1, 4,  'assets/games/endless-winter-ancestors.png'),
  ('Endless Winter: Cave Paintings',   1, 4,  'assets/games/endless-winter-cave-paintings.png'),
  ('Endless Winter: Rivers and Rafts', 1, 4,  'assets/games/endless-winter-rivers-and-rafts.png'),
  ('Endless Winter: Moduly',           1, 4,  'assets/games/endless-winter-moduly.png'),
  ('Kvízový road trip',                1, 99, 'assets/games/kvizovy-road-trip.png'),
  ('Orion',                            2, 2,  'assets/games/orion.png'),
  ('Pade',                             3, 7,  'assets/games/pade.png'),
  ('Podivuhodná stvoření',             1, 4,  'assets/games/podivuhodna-stvoreni.png'),
  ('Projekt A.R.T.',                   1, 6,  'assets/games/projekt-a-r-t.png'),
  ('Rok pandy',                        2, 5,  'assets/games/rok-pandy.png'),
  ('Rybí trh Ukidzi',                  2, 2,  'assets/games/rybi-trh-cukidzi.png'),
  ('SETI',                             1, 4,  'assets/games/seti.png'),
  ('Společenství dobrodruhů',          2, 6,  'assets/games/spolecenstvi-dobrodruhu.png'),
  ('Svit luny',                        2, 2,  'assets/games/svit-luny.png'),
  ('Trails of Tucana',                 1, 8,  'assets/games/trails-of-tucana.png'),
  ('Triominos',                        2, 4,  'assets/games/triominos.png'),
  ('Ukijo',                            1, 4,  'assets/games/ukijo.png'),
  ('Vú dú',                            2, 8,  'assets/games/vu-du.png'),
  ('Zářihvozd',                        1, 4,  'assets/games/zarihvozd.png'),
  ('Karak I',                          2, 5,  'assets/games/karak-i.png'),
  ('Karak II',                         2, 5,  'assets/games/karak-ii.png'),
  ('Hradní devatero',                  2, 5,  'assets/games/hradni-devatero.png');

-- ---------- Vlastníci ----------

-- Všechny hry vlastní Silvie, kromě Karak I (Marek) a Karak II (Zbyněk)
insert into game_owners (game_id, member_id)
select g.id, m.id
from games g
join members m on m.slug = 's'
where g.name not in ('Karak I', 'Karak II');

insert into game_owners (game_id, member_id)
select g.id, m.id from games g join members m on m.slug = 'm'
where g.name = 'Karak I';

insert into game_owners (game_id, member_id)
select g.id, m.id from games g join members m on m.slug = 'z'
where g.name = 'Karak II';

-- ---------- Kalendář – odehrané termíny ----------

insert into events (event_date, note) values
  ('2026-02-27', null),
  ('2026-03-13', null),
  ('2026-03-20', null),
  ('2026-03-27', null),
  ('2026-04-10', null),
  ('2026-04-17', null),
  ('2026-04-30', null),      -- čtvrtek místo pátku 1. 5.
  ('2026-05-07', null),
  ('2026-05-15', null),
  ('2026-05-22', null),
  ('2026-05-29', null),
  ('2026-06-19', null),
  ('2026-07-03', null);

-- Odehrané hry k termínům
insert into event_games (event_id, game_id, kind, note)
select e.id, g.id, 'played', v.note
from (values
  ('2026-02-27', 'Jungo',            null),
  ('2026-03-13', 'Karak I',          null),
  ('2026-03-20', 'Karak I',          'Rozšíření'),
  ('2026-03-27', 'Karak II',         null),
  ('2026-04-10', 'Vydry',            null),
  ('2026-04-17', 'Genius Square',    null),
  ('2026-04-17', 'Quartino',         null),
  ('2026-04-17', 'Trio',             null),
  ('2026-04-30', 'Flip 7',           null),
  ('2026-04-30', 'Bájné kostky',     null),
  ('2026-05-07', 'Karak I',          'Rozšíření'),
  ('2026-05-15', 'SETI',             null),
  ('2026-05-22', 'Karak II',         null),
  ('2026-05-29', 'SETI',             null),
  ('2026-06-19', 'Dej sem totem',    null),
  ('2026-07-03', 'Hradní devatero',  null)
) as v(event_date, game_name, note)
join events e on e.event_date = v.event_date::date
join games g on g.name = v.game_name;

-- Účastníci (S, M, Z podle podkladů)
insert into event_participants (event_id, member_id)
select e.id, m.id
from (values
  ('2026-02-27', 's,m,z'),
  ('2026-03-13', 's,m,z'),
  ('2026-03-20', 's,m,z'),
  ('2026-03-27', 's,m,z'),
  ('2026-04-10', 's,m,z'),
  ('2026-04-17', 's,m,z'),
  ('2026-04-30', 's,m,z'),
  ('2026-05-07', 's,m,z'),
  ('2026-05-15', 's,m,z'),
  ('2026-05-22', 's,m,z'),
  ('2026-05-29', 's,m,z'),
  ('2026-06-19', 's,m'),
  ('2026-07-03', 's,m')
) as v(event_date, slugs)
join events e on e.event_date = v.event_date::date
join members m on m.slug = any(string_to_array(v.slugs, ','));

-- Host mimo klub (7. 5. 2026 hrál i JB)
insert into event_participants (event_id, guest_name)
select e.id, 'JB' from events e where e.event_date = '2026-05-07';
