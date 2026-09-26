# JK Shop — Starter

Next.js + Prisma + Supabase starter matching the JK Shop UI mockups and admin panel.

## 1. Install
```bash
npm install
```

## 2. Set up Supabase
1. Create a free project at https://supabase.com
2. In **Project Settings → Database**, copy the connection string into `.env` as `DATABASE_URL`
3. In **Project Settings → API**, copy the URL, anon key, and service role key into `.env`
4. Copy `.env.example` to `.env` and fill in the values above

## 3. Create the database tables
```bash
npx prisma migrate dev --name init
```
This reads `prisma/schema.prisma` and creates every table (games, categories, pricelist_items, events, orders, etc.) in your Supabase Postgres database.

## 4. Seed sample data (MLBB Diamonds + payment methods)
```bash
npx tsx prisma/seed.ts
```

## 5. Run the dev server
```bash
npm run dev
```
Visit http://localhost:3000 — the home page pulls games live from the database.

## What's scaffolded so far
- `prisma/schema.prisma` — full data model (games, categories, form fields, pricelists, events, orders, order history, admins, payment methods)
- `app/page.tsx` — Home page, reads games from DB
- `app/game/[slug]/page.tsx` — game page skeleton, reads categories + pricelist for that game
- `app/api/orders/route.ts` — GET (list/filter orders) and POST (create order)
- `app/api/orders/[id]/route.ts` — PATCH (update status, logs to history table)
- `lib/prisma.ts`, `lib/supabase.ts` — DB and storage clients

## What's next to build
- Port the 7-step order-flow UI (Account Details → Order Quantity → Payment → Proof of Payment → Confirmation) from the mockup into `app/game/[slug]/page.tsx` as a client component
- Port the admin panel mockup (Dashboard, Orders, Pricelists, Categories, Events) into `app/admin/*`, wiring each view to the API routes instead of the sample in-memory data
- Add Supabase Auth for admin login + role check (staff vs super_admin)
- Add Supabase Storage upload for proof-of-payment and event hero-skin images
- Add Tailwind config to match the dark/green theme (`tailwind.config.js`)
