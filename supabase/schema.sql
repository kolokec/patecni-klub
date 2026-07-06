-- ============================================================
-- Páteční klub – schéma databáze (Supabase / PostgreSQL)
-- Spustit jednou v Supabase SQL editoru PŘED seed.sql.
-- ============================================================

-- ---------- Tabulky ----------

create table members (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,          -- 's', 'm', 'z' – používá se v UI i seedu
  display_name  text not null,                 -- 'Silvie'
  initial       text not null,                 -- 'S' – na přihlašovací dlaždici
  login_email   text unique not null,          -- syntetický e-mail pro Supabase Auth
  is_admin      boolean not null default false,
  hue           integer not null default 200,  -- odstín avataru (0–360)
  sort_order    integer not null default 0,
  auth_user_id  uuid unique references auth.users (id),
  host_question text,                           -- otázka pro host režim (veřejná)
  password_set  boolean not null default false  -- po prvním nastavení vlastního hesla
);

-- Odpověď na host otázku drží oddělená tabulka bez SELECT politiky,
-- ověřuje se výhradně přes RPC check_host_answer().
create table member_host_secrets (
  member_id   uuid primary key references members (id) on delete cascade,
  host_answer text not null
);

create table games (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  min_players integer,
  max_players integer,
  image_path  text,                            -- relativní cesta v repu, nebo URL do Storage
  created_at  timestamptz not null default now()
);

create table game_owners (
  game_id   uuid not null references games (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  primary key (game_id, member_id)
);

create table wishlist (
  member_id  uuid not null references members (id) on delete cascade,
  game_id    uuid not null references games (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, game_id)
);

create table events (
  id         uuid primary key default gen_random_uuid(),
  event_date date unique not null,
  note       text
);

create table event_games (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events (id) on delete cascade,
  game_id     uuid not null references games (id) on delete cascade,
  kind        text not null check (kind in ('played', 'proposal')),
  proposed_by uuid references members (id) on delete set null,  -- jen u kind='proposal'
  note        text
);

create table event_participants (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events (id) on delete cascade,
  member_id  uuid references members (id) on delete cascade,
  guest_name text,                             -- host mimo klub (např. 'JB'); member_id pak null
  check (member_id is not null or guest_name is not null),
  unique (event_id, member_id)
);

create table ratings (
  event_id  uuid not null references events (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  score     integer not null check (score between 1 and 10),
  primary key (event_id, member_id)
);

-- ---------- Pomocné funkce pro RLS ----------

create or replace function current_member_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from members where auth_user_id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from members where auth_user_id = auth.uid()), false);
$$;

-- ---------- RPC ----------

-- Ověření odpovědi na host otázku (case-insensitive, bez okrajových mezer).
create or replace function check_host_answer(p_member_slug text, p_answer text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from member_host_secrets s
    join members m on m.id = s.member_id
    where m.slug = p_member_slug
      and lower(trim(s.host_answer)) = lower(trim(p_answer))
  );
$$;

-- Člen si po prvním přihlášení nastavil vlastní heslo.
create or replace function mark_password_set()
returns void
language sql security definer set search_path = public as $$
  update members set password_set = true where auth_user_id = auth.uid();
$$;

-- Člen si nastaví vlastní host otázku a odpověď.
create or replace function set_host_secret(p_question text, p_answer text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := current_member_id();
begin
  if v_member is null then
    raise exception 'Nepřihlášený uživatel';
  end if;
  update members set host_question = p_question where id = v_member;
  insert into member_host_secrets (member_id, host_answer)
  values (v_member, p_answer)
  on conflict (member_id) do update set host_answer = excluded.host_answer;
end;
$$;

-- ---------- Row Level Security ----------

alter table members             enable row level security;
alter table member_host_secrets enable row level security;
alter table games               enable row level security;
alter table game_owners         enable row level security;
alter table wishlist            enable row level security;
alter table events              enable row level security;
alter table event_games         enable row level security;
alter table event_participants  enable row level security;
alter table ratings             enable row level security;

-- members: veřejné čtení (dlaždice, jména u sbírek); zápis jen přes RPC/seed
create policy members_select on members for select using (true);

-- member_host_secrets: žádná select/insert/update politika – přístup jen přes RPC

-- games: veřejné čtení; přidat může každý člen; upravit vlastník/spoluvlastník
create policy games_select on games for select using (true);
create policy games_insert on games for insert to authenticated
  with check (current_member_id() is not null);
create policy games_update on games for update to authenticated
  using (
    is_admin() or exists (
      select 1 from game_owners o
      where o.game_id = games.id and o.member_id = current_member_id()
    )
    -- hry bez vlastníka (jen v hledáčku / návrhu) smí doplnit kdokoliv z členů
    or not exists (select 1 from game_owners o where o.game_id = games.id)
  );

-- game_owners: veřejné čtení; „taky mám doma“ = insert sebe; odebrat jen sebe
create policy game_owners_select on game_owners for select using (true);
create policy game_owners_insert on game_owners for insert to authenticated
  with check (member_id = current_member_id());
create policy game_owners_delete on game_owners for delete to authenticated
  using (member_id = current_member_id());

-- wishlist: veřejné čtení (tip na dárky); vlastní záznamy si člen spravuje sám
create policy wishlist_select on wishlist for select using (true);
create policy wishlist_insert on wishlist for insert to authenticated
  with check (member_id = current_member_id());
create policy wishlist_delete on wishlist for delete to authenticated
  using (member_id = current_member_id());

-- events: veřejné čtení; budoucí termín smí založit i člen (návrh hry, účast),
-- historii a úpravy spravuje admin
create policy events_select on events for select using (true);
create policy events_insert on events for insert to authenticated
  with check (is_admin() or event_date >= current_date);
create policy events_update on events for update to authenticated
  using (is_admin());
create policy events_delete on events for delete to authenticated
  using (is_admin());

-- event_games: veřejné čtení; odehrané zapisuje admin, návrhy členové
create policy event_games_select on event_games for select using (true);
create policy event_games_insert on event_games for insert to authenticated
  with check (
    (kind = 'played' and is_admin())
    or (
      kind = 'proposal'
      and proposed_by = current_member_id()
      and exists (select 1 from events e where e.id = event_id and e.event_date >= current_date)
    )
  );
create policy event_games_delete on event_games for delete to authenticated
  using (is_admin() or proposed_by = current_member_id());

-- event_participants: čtou jen přihlášení (v kalendáři se účast nezobrazuje);
-- admin zapisuje kohokoliv, člen sám sebe na budoucí/dnešní termín
create policy event_participants_select on event_participants for select to authenticated
  using (true);
create policy event_participants_insert on event_participants for insert to authenticated
  with check (
    is_admin()
    or (
      member_id = current_member_id()
      and exists (select 1 from events e where e.id = event_id and e.event_date >= current_date)
    )
  );
create policy event_participants_delete on event_participants for delete to authenticated
  using (is_admin() or member_id = current_member_id());

-- ratings: průměry jsou veřejné (tooltip); hodnotí jen účastník termínu
create policy ratings_select on ratings for select using (true);
create policy ratings_upsert on ratings for insert to authenticated
  with check (
    member_id = current_member_id()
    and exists (
      select 1 from event_participants p
      where p.event_id = ratings.event_id and p.member_id = current_member_id()
    )
  );
create policy ratings_update on ratings for update to authenticated
  using (member_id = current_member_id());

-- ---------- Storage bucket na fotky her ----------

insert into storage.buckets (id, name, public)
values ('game-images', 'game-images', true)
on conflict (id) do nothing;

create policy game_images_read on storage.objects for select
  using (bucket_id = 'game-images');
create policy game_images_write on storage.objects for insert to authenticated
  with check (bucket_id = 'game-images');
create policy game_images_replace on storage.objects for update to authenticated
  using (bucket_id = 'game-images');
