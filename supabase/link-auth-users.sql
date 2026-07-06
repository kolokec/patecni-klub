-- ============================================================
-- Páteční klub – propojení členů s Auth účty
-- Spustit AŽ PO ručním založení uživatelů v Supabase dashboardu
-- (Authentication → Users → Add user), s těmito e-maily:
--   s@patecni-klub.example   (Silvie)
--   m@patecni-klub.example   (Marek)
--   z@patecni-klub.example   (Zbyněk)
-- Heslo každému nastavte dočasné; člen si ho pak změní ve svém
-- profilu na webu.
-- ============================================================

update members
set auth_user_id = u.id
from auth.users u
where u.email = members.login_email
  and members.auth_user_id is null;

-- Kontrola – všichni členové by měli mít vyplněné auth_user_id:
select slug, display_name, auth_user_id from members order by sort_order;
