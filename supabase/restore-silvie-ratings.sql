-- ============================================================
-- Doplnění Silviiných hodnocení her (znovuzadání toho, co už dřív
-- ohodnotila, ztraceno při přechodu na hodnocení podle hry).
-- Bezpečné spustit opakovaně – při druhém běhu jen přepíše stejnou
-- hodnotou (ON CONFLICT).
-- ============================================================

insert into ratings (game_id, member_id, score)
select g.id, m.id, v.score
from (values
  ('Jungo', 8),
  ('Karak I', 7),
  ('Karak II', 7),
  ('Vydry', 5),
  ('SETI', 7),
  ('Dej sem totem', 7),
  ('Hradní devatero', 9),
  ('Genius Square', 10),  -- 17.4.2026, hráno spolu s Quartinem a Triem
  ('Quartino', 10),
  ('Trio', 10)
) as v(game_name, score)
join games g on g.name = v.game_name
join members m on m.slug = 's'
on conflict (game_id, member_id) do update set score = excluded.score;

-- kontrola
select g.name as hra, r.score as znamka
from ratings r
join games g on g.id = r.game_id
join members m on m.id = r.member_id
where m.slug = 's'
order by g.name;
