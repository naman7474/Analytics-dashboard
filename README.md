# A/B Dashboard

Internal analytics dashboard for comparing Shopify (A) vs Ratio (B).

## Auth and Access

- Google sign-in is required for the app.
- Any user with an email ending in `@primathon.in` gets `admin` access.
- All other signed-in users are `viewer`s.
- Viewer access is merchant-specific and is configured per merchant through `viewerEmails`.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Fill in:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `CRUX_API_KEY` (optional)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` if you want merchant data in Supabase

4. Start the app:

```bash
npm run dev
```

## Merchant Data

- Safe merchant metadata lives in `data/merchants.json`.
- Server-only vendor credentials live in `data/merchant-secrets.local.json`.
- `data/merchant-secrets.local.json` is gitignored and should not be committed.
- If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, the app uses Supabase instead of local JSON files.

## Supabase Migration

1. Run the SQL in `supabase/migrations/20260323_create_merchant_store.sql`.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
3. Sync the current local merchant files into Supabase:

```bash
npm run sync:merchants:supabase
```

4. Restart the app. Merchant reads and writes will now use Supabase automatically.

## Notes

- Existing credentials that were previously committed should be rotated.
- Do not use the Supabase anon key for the merchant store. The app needs the server-only service role key because merchant secrets are stored in the database.
- The performance tab uses CrUX for the live Shopify website and PostHog for Ratio.
- If `CRUX_API_KEY` is not set, the app falls back to PageSpeed Insights origin field data.
