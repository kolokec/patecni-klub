-- ============================================================
-- Doplnění Markových hodnocení her (znovuzadání toho, co už dřív
-- ohodnotil, ztraceno při přechodu na hodnocení podle hry).
-- Bezpečné spustit opakovaně – při druhém běhu jen přepíše stejnou
-- hodnotou (ON CONFLICT).
-- ============================================================

insert into ratings (game_id, member_id, score)
select g.id, m.id, v.score
from (values
  ('Jungo', 6),
  ('Karak I', 10),
  ('Karak II', 9),
  ('Vydry', 6),
  ('SETI', 8),
  ('Dej sem totem', 8),
  ('Hradní devatero', 7),
  ('Genius Square', 7),  -- 17.4.2026, hráno spolu s Quartinem a Triem
  ('Quartino', 7),
  ('Trio', 7),
  ('5 věží', 5),         -- 17.7.2026, hráno spolu se Stezkami
  ('Stezky', 5)
) as v(game_name, score)
join games g on g.name = v.game_name
join members m on m.slug = 'm'
on conflict (game_id, member_id) do update set score = excluded.score;

-- kontrola
select g.name as hra, r.score as znamka
from ratings r
join games g on g.id = r.game_id
join members m on m.id = r.member_id
where m.slug = 'm'
order by g.name;
