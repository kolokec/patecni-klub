# Páteční klub

Webová evidence deskových her pro uzavřenou partu: kdo co vlastní, co se hrálo, jak to dopadlo, co se bude hrát příště a co si kdo přeje pořídit.

- **Frontend:** statický web (HTML/CSS/JS bez frameworku), hostovaný na GitHub Pages
- **Backend:** Supabase (databáze, přihlašování, úložiště fotek)
- Dokud není vyplněný `js/config.js`, web běží v **náhledovém režimu** nad lokálními ukázkovými daty (`js/demo-data.js`) – vše je vidět, ale nejde se přihlásit ani nic měnit.

## Struktura

```
index.html                  hlavní (a jediná) stránka
css/style.css               styly – noční město v dešti
js/config.js                ← SEM patří Supabase URL a anon key
js/app.js                   logika UI
js/api.js                   datová vrstva (Supabase / demo)
js/demo-data.js             lokální data pro náhled bez Supabase
assets/bg.svg               ilustrace pozadí – lze kdykoliv nahradit jiným souborem
assets/games/*.png          fotky her (seed)
supabase/schema.sql         schéma DB + zabezpečení (spustit 1.)
supabase/seed.sql           naplnění daty klubu (spustit 2.)
supabase/link-auth-users.sql  propojení členů s účty (spustit 3., po založení uživatelů)
.github/workflows/keep-alive.yml  ping, aby free Supabase neusnul
```

## Lokální náhled

Web nejde otevřít poklepáním na `index.html` (prohlížeč přes `file://` nenačte JavaScript moduly – zobrazí se jen prázdná kostra). Místo toho spusť ve složce webu malý server a otevři adresu, kterou vypíše:

```
python -m http.server 8321
```

→ **http://localhost:8321** (ukončení: Ctrl+C v okně serveru). Na GitHub Pages tohle řešit netřeba.

## Nasazení krok za krokem

### 1. Supabase

1. Na [supabase.com](https://supabase.com) založ projekt (Free tier stačí).
2. V **SQL Editoru** spusť obsah `supabase/schema.sql`, potom `supabase/seed.sql`.
3. V **Authentication → Sign In / Up** vypni „Confirm email“ (uživatelé se zakládají ručně, e-maily jsou syntetické).
4. V **Authentication → Users → Add user** založ tři uživatele s dočasnými hesly:
   - `s@patecni-klub.example`
   - `m@patecni-klub.example`
   - `z@patecni-klub.example`
5. V SQL Editoru spusť `supabase/link-auth-users.sql` – kontrolní dotaz na konci musí u všech tří členů ukázat vyplněné `auth_user_id`.
6. V **Settings → API** si zkopíruj **Project URL** a **anon public key**.

### 2. Web

1. Do `js/config.js` vlož URL a anon key z předchozího kroku.
2. Založ veřejný GitHub repozitář `patecni-klub` a nahraj do něj obsah této složky.
3. V repozitáři: **Settings → Pages → Source: Deploy from a branch → main / root**.
4. Web pojede na `https://<uzivatel>.github.io/patecni-klub`.

### 3. Keep-alive

V repozitáři **Settings → Secrets and variables → Actions** přidej dva secrets:

- `SUPABASE_URL` – Project URL
- `SUPABASE_ANON_KEY` – anon public key

Workflow pak každé 3 dny pošle drobný dotaz, aby free projekt nebyl pozastaven.

### 4. První přihlášení členů

1. Admin dá každému členovi **dočasné heslo** (to, které zadal při zakládání účtu v kroku 1.4 – klidně všem stejné).
2. Člen se přihlásí svou dlaždicí a dočasným heslem.
3. Web pozná první přihlášení a **sám otevře profil s výzvou k nastavení vlastního hesla**. Dokud si ho člen nenastaví, výzva se ukáže při každém přihlášení.
4. V profilu (kdykoliv později: klik na svůj avatar vpravo nahoře) si člen může nastavit i **host otázku a odpověď** – kdo ji zodpoví, uvidí jeho sbírku a hledáček (tip na dárky).

## Údržba

- **Výměna pozadí:** nahraď `assets/bg.svg` (případně uprav URL v `css/style.css`, sekce `.scene`).
- **Nový člen / změna admina:** ručně v Supabase – řádek v tabulce `members` + uživatel v Authentication + propojení `auth_user_id` (viz `link-auth-users.sql`). UI pro správu členů je vědomě mimo rozsah v1.
- **Fotky her:** nové hry nahrávají fotky do Supabase Storage přímo z webu; seedové fotky žijí v repu ve složce `assets/games/`.
