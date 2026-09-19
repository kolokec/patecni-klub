-- ============================================================
-- Migrace: admin smí spravovat vlastníky hry za kohokoliv
-- (dosud šlo jen „taky mám doma“ / odebrat sám sebe).
-- Nemění žádná data, jen pravidla přístupu (RLS).
-- ============================================================

drop policy if exists game_owners_insert on game_owners;
drop policy if exists game_owners_delete on game_owners;

create policy game_owners_insert on game_owners for insert to authenticated
  with check (member_id = current_member_id() or is_admin());

create policy game_owners_delete on game_owners for delete to authenticated
  using (member_id = current_member_id() or is_admin());
