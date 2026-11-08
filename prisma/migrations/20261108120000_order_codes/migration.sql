-- Human-readable order IDs: <category code>-<MMDD><daily count>, e.g. DIA-1108001

ALTER TABLE "Category" ADD COLUMN "code" TEXT;
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

ALTER TABLE "Order" ADD COLUMN "orderCode" TEXT;
CREATE INDEX "Order_orderCode_idx" ON "Order"("orderCode");

CREATE TABLE "OrderCounter" (
    "key" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OrderCounter_pkey" PRIMARY KEY ("key")
);

-- Codes for existing categories
UPDATE "Category" c SET "code" = v.code
FROM (VALUES
  ('mlbb', 'Diamonds', 'DIA'),
  ('mlbb', 'Pre-Order Event', 'PRE'),
  ('mlbb', 'Event Skin Gifting', 'ESG'),
  ('mlbb', 'Shop Items', 'SHI'),
  ('mlbb', 'Shop Skins', 'SKN'),
  ('mlbb', 'Starlight', 'STL'),
  ('mlbb', 'Callback Form', 'CBF'),
  ('mlbb', 'ML Top Fan Border', 'TFB'),
  ('mlbb', 'MLBB Global Server', 'GLB'),
  ('mlbb', 'ML Profile / Album Likes', 'LKS'),
  ('mlbb', 'ML Charisma', 'CHA'),
  ('mlbb', 'ML Charisma via Dias', 'CHD'),
  ('mlbb', 'Pilot Service', 'PLT'),
  ('mlbb', 'Dias Sale - Direct Top Up', 'DTU'),
  ('mlbb', 'ML via Log In Diamond', 'LID'),
  ('mcgg', 'Order', 'MCG'),
  ('robux-plus', 'Order', 'RBX'),
  ('valorant', 'Order', 'VAL'),
  ('wuthering-waves', 'Lunite', 'WUW'),
  ('honor-of-kings', 'Token', 'HOK'),
  ('league-of-legends', 'Core', 'LOL'),
  ('league-of-legends', 'Riot Points Gift Card', 'RPG'),
  ('wild-rift', 'Core', 'WRC'),
  ('cod-mobile', 'CP', 'COD'),
  ('cod-mobile', 'GS - CP', 'CGS')
) AS v(slug, name, code), "Game" g
WHERE c."gameId" = g."id" AND g."slug" = v.slug AND c."name" = v.name;

-- Number existing orders per category per Philippine day, oldest first
CREATE TEMP TABLE _numbered AS
SELECT o."id",
       c."code",
       to_char((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila', 'MMDD') AS md,
       to_char((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS d,
       row_number() OVER (
         PARTITION BY o."categoryId", ((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::date
         ORDER BY o."createdAt", o."id"
       ) AS n
FROM "Order" o
JOIN "Category" c ON c."id" = o."categoryId"
WHERE c."code" IS NOT NULL;

UPDATE "Order" o
SET "orderCode" = x."code" || '-' || x.md || lpad(x.n::text, 3, '0')
FROM _numbered x
WHERE o."id" = x."id";

INSERT INTO "OrderCounter" ("key", "seq")
SELECT "code" || '-' || d, max(n)
FROM _numbered
GROUP BY "code", d;

DROP TABLE _numbered;
