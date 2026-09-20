# Local setup

## 1. Install dependencies

```bash
npm install
```

## 2. Supabase project

A Supabase project has already been created for this app and its schema
migrations (`supabase/migrations/0001_init.sql` through `0003_harden_functions.sql`)
are already applied:

- Project ref: `wmsrbfnnpmbrbbhollxo`
- URL: `https://wmsrbfnnpmbrbbhollxo.supabase.co`

`.env.local` already has `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` filled in. **You still need to provide the
service-role key** — it can't be retrieved through automated tooling for
security reasons:

1. Open the [Supabase dashboard](https://supabase.com/dashboard/project/wmsrbfnnpmbrbbhollxo/settings/api-keys).
2. Copy the **service_role** secret key.
3. Paste it into `.env.local` as `SUPABASE_SERVICE_ROLE_KEY=...`.

Without this, login, admin actions, and audit logging will fail — most
server code reads `getServerEnv()`, which throws if it's missing.

## 3. Create the first user (owner_admin)

There is no public registration. The very first account created becomes
`owner_admin` automatically. Create it from the Supabase dashboard:

1. Go to **Authentication > Users > Add user** in the Supabase dashboard.
2. Create a user with your email, set a password (or use "send invite" if
   email sending is configured for the project), and confirm the email.
3. Sign in at `http://localhost:3000/login` with those credentials — you'll
   land in the dashboard with full Owner/Admin access, and can invite
   further staff from **Users** in the app itself from then on.

(Every subsequent user must be invited from the app's **Users** page —
that's the only way in, by design; see architecture rule 6 in `AGENTS.md`
for why there's no public sign-up.)

## 4. Run the app

```bash
npm run dev
```

Visit `http://localhost:3000`.

## 5. Verify

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

All four should pass before you consider a change done.

## 6. e2e tests (optional, one-time setup)

`npm run test:e2e` needs a dedicated test account first — see "e2e tests"
in `CLAUDE.md` for the one-time setup (`scripts/create-e2e-user.mjs` plus
one manual SQL step) and what to clean up afterward.
