# Supabase — dress catalogue & quote requests

Backend for the dress catalogue and the "request a quote" form. Everything lives in one
migration: [`migrations/0001_dresses_quotes.sql`](migrations/0001_dresses_quotes.sql).

What it creates:

| Object | Notes |
| --- | --- |
| `public.dresses` | Catalogue. Anyone can read rows where `published = true`; the signed-in owner can do everything. `updated_at` is set by a trigger on every update. |
| `public.quote_requests` | Leads. No anon access at all. The owner can read / update / delete. Rows are inserted by the server with the **service-role** key (bypasses RLS). |
| Bucket `dresses` (public) | 8 MB, `image/webp`, `image/jpeg`, `image/png`. Paths: `<dress-id>/<n>.webp`, `<dress-id>/<n>-thumb.webp`. Public read; owner uploads/edits/deletes. |
| Bucket `quote-refs` (private) | 5 MB, `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`. Paths: `<yyyy-mm>/<uuid>.<ext>`. Server uploads with the service-role key; the owner can only read (to create signed URLs). |

The migration is idempotent: running it again (or pasting it into the SQL editor twice) is safe.

## Setup (new project)

1. **Create the project** in the Supabase dashboard, region **ap-south-1** (Mumbai). Postgres 17.
2. **Apply the migration**, either:
   - CLI: `supabase link --project-ref <project-ref>` then `supabase db push`, or
   - Dashboard: SQL Editor → paste the whole of `migrations/0001_dresses_quotes.sql` → Run.
3. **Turn off public sign-ups**: Authentication → Providers (Sign In / Providers) → Email →
   disable **"Allow new users to sign up"**. The admin area relies on there being exactly one
   (owner) account — any authenticated user has full access to dresses and leads.
4. **Create the owner user**: Authentication → Users → Add user → Create new user, with the
   owner's email + a strong password (tick "Auto confirm user").
5. **Copy the keys** (Project Settings → API / Data API) into the app's environment:

   | Env var | Value | Exposure |
   | --- | --- | --- |
   | `PUBLIC_SUPABASE_URL` | Project URL | public (browser) |
   | `PUBLIC_SUPABASE_ANON_KEY` | `anon` key | public (browser) |
   | `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key | **server-only secret** — never prefix with `PUBLIC_`, never ship to the browser, never commit |

## Local development (optional)

`config.toml` is set up for a local stack on ports `5632x` (so it does not clash with other
local Supabase projects) with sign-ups disabled, matching production:

```sh
supabase start          # applies migrations/ automatically
supabase db reset       # re-apply from scratch
supabase stop
```

Local keys are printed by `supabase status`. Create a local owner with the admin API, e.g.

```sh
curl -X POST http://127.0.0.1:56321/auth/v1/admin/users \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"change-me","email_confirm":true}'
```

Never `supabase link` this folder to any project other than this client's.
