# ŽA-JO KOMERC

Bilingual storefront for ŽA-JO KOMERC, Kruševac. Serbian Latin is the default. English is under `/en`. Currency is RSD. Time zone is Europe/Belgrade.

The catalog was copied from the public WooCommerce store at [proizvodnjacarapa.com](https://proizvodnjacarapa.com/). Prices, names, sizes and photographs are the published ones. Fields the old site did not publish stay empty. See `docs/MIGRATION.md`.

## Stack

- Next.js 16 App Router, TypeScript, Tailwind CSS
- Drizzle ORM
- Neon Postgres when `DATABASE_URL` is set
- Local PGlite in `.data/pglite` when `DATABASE_URL` is unset and the app is not on Vercel
- Better Auth (email and password, optional two-factor plugin)
- Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set; otherwise messages are stored in `email_outbox` with status `skipped_unconfigured`
- Vercel for deployment. This repository has not been deployed.

Card numbers are not collected. Checkout offers cash on delivery and bank transfer. Bank details appear only after they are saved in admin settings.

## Local setup

```bash
npm install
npm run dev
```

`npm run dev` writes missing local secrets into `.env.local`, applies `drizzle/`, loads the verified catalog if the products table is empty, and creates the owner account.

Sign in at [http://localhost:3000/admin/prijava](http://localhost:3000/admin/prijava).

- Email: the value of `SEED_ADMIN_EMAIL` (default `vlasnik@zajo.local`)
- Password: `SEED_ADMIN_PASSWORD` in `.env.local`

## Production database and email

1. Create a Neon database and set `DATABASE_URL`.
2. Set `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL` to the real origin.
3. Set `RESEND_API_KEY`, `EMAIL_FROM` and `ORDERS_EMAIL`.
4. Deploy to Vercel only after those values exist. `npm run build` runs the same database setup. On Vercel, without `DATABASE_URL`, the catalog falls back to the JSON snapshot and checkout is disabled.

Do not point this project at the live domain `proizvodnjacarapa.com` until the old site is retired and redirects are approved.

The Vercel CLI is not required to run the shop locally. Install it with `npm i -g vercel` when you are ready to link the project, pull environment variables, or deploy.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local database setup and Next.js |
| `npm run build` | Same setup, then production build |
| `npm test` | Pricing, stock, discounts, order transitions, roles |
| `npm run db:generate` | Write a new Drizzle migration after a schema change |
| `npm run db:setup` | Migrate and seed without starting the server |

## Backup

- Neon: use Neon point-in-time recovery and a scheduled `pg_dump` kept outside the application.
- Local: `.data/pglite` is disposable development data. It is gitignored.
- Product photographs: originals used for the migration live outside this repo. WebP copies are in `public/media/products`.
- Do not commit `.env.local`.

## What is still waiting on the business

Shipping price, free-delivery threshold, minimum order, PIB, matični broj, bank account, tax treatment, and a Serbian payment gateway. Legal pages are editable placeholders and need a lawyer. Numeric stock and SKUs were not on the public site; the import template is `public/templates/stock-import-template.csv`.

A generated order confirmation is not a fiscal receipt.
