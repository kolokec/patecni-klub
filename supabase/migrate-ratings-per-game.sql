-- ============================================================
-- Migrace: hodnocení podle hry, ne podle termínu
-- Spustit JEDNOU v SQL Editoru na už běžícím projektu (schema.sql
-- a seed.sql už byly spuštěné dřív). Po migraci hodnotí člen hru
-- jednou celkově, bez ohledu na to, kolikrát a kdy ji hrál.
--
-- Dosavadní (zkušební) hodnocení se smažou – přehled, co bylo
-- zadané, ať jde snadno zadat znovu přímo na dlaždici hry, je
-- vypsaný v chatu. U termínů s jednou hrou je to jednoznačné,
-- u dvou termínů s víc hrami najednou (17.4. a 17.7.2026) je
-- potřeba se rozhodnout / vzpomenout, které hry se to týkalo.
-- ============================================================

begin;

drop policy if exists ratings_upsert on ratings;
drop policy if exists ratings_update on ratings;

truncate table ratings;

alter table ratings add column game_id uuid references games (id) on delete cascade;
alter table ratings drop constraint ratings_pkey;
alter table ratings drop column event_id;
alter table ratings alter column game_id set not null;
alter table ratings add primary key (game_id, member_id);

create policy ratings_upsert on ratings for insert to authenticated
  with check (
    member_id = current_member_id()
    and exists (
      select 1
      from event_participants p
      join event_games eg on eg.event_id = p.event_id and eg.kind = 'played'
      where p.member_id = current_member_id() and eg.game_id = ratings.game_id
    )
  );

create policy ratings_update on ratings for update to authenticated
  using (member_id = current_member_id());

commit;

-- kontrola: tabulka je prázdná a má nový tvar (game_id, member_id, score)
select * from ratings;
