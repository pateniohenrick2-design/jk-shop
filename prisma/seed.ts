import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

type Item = { name: string; price: number; originalPrice?: number; status?: 'available' | 'sold_out'; notes?: string };
type Field = { label: string; helperText?: string };
type Category = { name: string; group: 'main' | 'others'; fields?: Field[]; items?: Item[] };
type GameDef = { name: string; slug: string; description?: string; categories: Category[] };

const SERVER_HELPER =
  'Please specify your account server: PH, INDO, USA, SG, MY, RU, GLOBAL. Example: 12345 PH';
const MLBB_FIELDS: Field[] = [
  { label: 'Enter User ID' },
  { label: 'Enter Server ID', helperText: SERVER_HELPER },
  { label: 'Enter IGN' },
];

const games: GameDef[] = [
  {
    name: 'Mobile Legend: Bang Bang',
    slug: 'mlbb',
    description: 'Diamonds | Items | Skins | Others',
    categories: [
      {
        name: 'Diamonds', group: 'main', fields: MLBB_FIELDS,
        items: [
          { name: 'Weekly Diamond Pass', price: 114 },
          { name: '11 Diamonds', price: 12 }, { name: '22 Diamonds', price: 23 },
          { name: '56 Diamonds', price: 55 }, { name: '112 Diamonds', price: 110 },
          { name: '168 Diamonds', price: 164 }, { name: '223 Diamonds', price: 219 },
          { name: '279 Diamonds', price: 273 }, { name: '301 Diamonds', price: 296 },
          { name: '336 Diamonds', price: 332 },
        ],
      },
      {
        name: 'Pre-Order Event', group: 'main', fields: [{ label: 'Event' }, ...MLBB_FIELDS],
        items: [
          { name: 'Weekly Diamond Pass', price: 112, originalPrice: 114, notes: 'Pre-order deal — ends soon' },
          { name: '279 Diamonds', price: 271, originalPrice: 273, notes: 'Pre-order deal — ends soon' },
          { name: '301 Diamonds', price: 293, originalPrice: 296, notes: 'Pre-order deal — ends soon' },
          { name: '336 Diamonds', price: 329, originalPrice: 332, notes: 'Pre-order deal — ends soon' },
          { name: '570 Diamonds', price: 542, originalPrice: 547, notes: 'Pre-order deal — ends soon' },
          { name: '1163 Diamonds', price: 1089, originalPrice: 1099, notes: 'Pre-order deal — ends soon' },
          { name: '2398 Diamonds', price: 2154, originalPrice: 2174, notes: 'Pre-order deal — ends soon' },
          { name: '6042 Diamonds', price: 5397, originalPrice: 5447, notes: 'Pre-order deal — ends soon' },
        ],
      },
      { name: 'Event Skin Gifting', group: 'main', fields: MLBB_FIELDS, items: [] },
      {
        name: 'Shop Items', group: 'main', fields: MLBB_FIELDS,
        items: [
          { name: 'Normal Starlight', price: 155 }, { name: 'Premium Starlight', price: 310 },
          { name: 'Flag Change', price: 154 }, { name: 'Squad Rename', price: 154 },
          { name: 'Rename Card', price: 142 }, { name: 'Emote', price: 74 }, { name: 'Emote (Alt)', price: 54 },
        ],
      },
      {
        name: 'Shop Skins', group: 'main', fields: MLBB_FIELDS,
        items: [
          { name: 'Epic (1089💎)', price: 544 },
          { name: 'Epic (899💎)', price: 439 },
          { name: 'Special (749💎)', price: 374 },
          { name: 'Elite (599💎)', price: 294 },
          { name: 'Elite (399💎)', price: 214 },
          { name: 'Normal (299💎)', price: 169 },
          { name: 'Normal (269💎)', price: 154 },
          { name: 'Painted (188💎)', price: 109 },
        ],
      },
      { name: 'Callback Form', group: 'others', fields: [{ label: 'Invitation Code' }, { label: 'Enter IGN' }], items: [] },
      {
        name: 'ML Top Fan Border', group: 'others', fields: MLBB_FIELDS,
        items: [
          { name: 'Border Airplane', price: 3199, notes: "Moonton's email + 1 time code · 1–2 days waiting · 1–3 hrs process · No rush" },
          { name: 'Border Airplane + 1,000 Dias', price: 3349, notes: "Moonton's email + 1 time code · 1–2 days waiting · 1–3 hrs process · No rush" },
        ],
      },
      {
        name: 'MLBB Global Server', group: 'others', fields: MLBB_FIELDS,
        items: [
          { name: 'WDP', price: 97 }, { name: 'Twilight Pass', price: 511 }, { name: 'WEB', price: 52 }, { name: 'MEB', price: 248 },
          { name: '86 Diamonds', price: 79 }, { name: '172 Diamonds', price: 157 }, { name: '257 Diamonds', price: 226 },
          { name: '344 Diamonds', price: 312 }, { name: '429 Diamonds', price: 389 }, { name: '514 Diamonds', price: 446 },
          { name: '600 Diamonds', price: 540 }, { name: '706 Diamonds', price: 611 }, { name: '878 Diamonds', price: 766 },
          { name: '963 Diamonds', price: 834 }, { name: '1050 Diamonds', price: 904 }, { name: '1220 Diamonds', price: 1060 },
          { name: '1412 Diamonds', price: 1220 }, { name: '2195 Diamonds', price: 1848 }, { name: '2539 Diamonds', price: 2159 },
          { name: '3688 Diamonds', price: 3089 }, { name: '5532 Diamonds', price: 4633 }, { name: '6238 Diamonds', price: 5239 },
          { name: '9288 Diamonds', price: 7698 },
        ],
      },
      {
        name: 'ML Profile / Album Likes', group: 'others', fields: MLBB_FIELDS,
        items: [
          { name: '100 Likes', price: 45, notes: 'Within 1–3 days · No rush' },
          { name: '500 Likes', price: 210, notes: 'Within 1–3 days · No rush' },
        ],
      },
      {
        name: 'ML Charisma', group: 'others', fields: MLBB_FIELDS,
        items: [
          { name: '100k Charisma', price: 105 }, { name: '200k Charisma', price: 210 }, { name: '300k Charisma', price: 300 },
          { name: '400k Charisma', price: 410 }, { name: '500k Charisma', price: 490 }, { name: '600k Charisma', price: 580 },
          { name: '700k Charisma', price: 690 }, { name: '800k Charisma', price: 765 }, { name: '900k Charisma', price: 855 },
          { name: '1M Charisma', price: 910 },
        ],
      },
      {
        name: 'ML Charisma via Dias', group: 'others', fields: MLBB_FIELDS,
        items: [
          { name: 'Gold Moon', price: 479, notes: 'Random charisma · Within 1–2 days · No rush' },
          { name: 'Paradise Island', price: 259, notes: 'Random charisma · Within 1–2 days · No rush' },
          { name: 'Angel Ark', price: 259, notes: 'Random charisma · Within 1–2 days · No rush' },
          { name: '20 Dias Charisma', price: 20, notes: 'Random charisma · Within 1–2 days · No rush' },
        ],
      },
      {
        name: 'Pilot Service', group: 'others', fields: MLBB_FIELDS,
        items: [
          { name: 'Epic–Legend', price: 20, notes: '+5 if spam hero' }, { name: 'Legend–Mythic', price: 25, notes: '+5 if spam hero' },
          { name: 'Mythic–Honor', price: 30, notes: '+5 if spam hero' }, { name: 'Honor–Glory', price: 35, notes: '+5 if spam hero' },
          { name: 'Glory–Immortal', price: 40, notes: '+5 if spam hero' }, { name: 'Immortal', price: 50, notes: '+5 if spam hero' },
        ],
      },
      {
        name: 'Dias Sale - Direct Top Up', group: 'others', fields: MLBB_FIELDS,
        items: [{ name: '7193 Diamonds (PH)', price: 4980, notes: 'Via direct top up · 1st come 1st serve · Strictly not for rush' }],
      },
      {
        name: 'ML via Log In Diamond', group: 'others', fields: MLBB_FIELDS,
        items: [{ name: '6,000 Diamonds', price: 3349, notes: "Moonton's email + 1 time code · 1–2 days waiting · Fast 10–30 mins · No rush" }],
      },
    ],
  },
  { name: 'Magic Chess: GoGo', slug: 'mcgg', categories: [
      { name: 'Order', group: 'main', fields: MLBB_FIELDS, items: [] },
  ]},
  { name: 'Robux Plus', slug: 'robux-plus', categories: [
      { name: 'Order', group: 'main', fields: [{ label: 'Username' }, { label: 'Display Name' }, { label: 'Profile Screenshot (attach)' }], items: [] },
  ]},
  { name: 'Valorant', slug: 'valorant', categories: [
      { name: 'Order', group: 'main', fields: [{ label: 'Riot ID & Tag' }], items: [] },
  ]},
  { name: 'Wuthering Waves', slug: 'wuthering-waves', categories: [
      { name: 'Lunite', group: 'main', fields: [{ label: 'Enter User ID' }, { label: 'Server' }], items: [
        { name: 'Lunite Sub', price: 279 }, { name: '60 Lunite', price: 55 }, { name: '330 Lunite', price: 281 },
        { name: '1090 Lunite', price: 841 }, { name: '2240 Lunite', price: 1684 }, { name: '3880 Lunite', price: 2760 },
        { name: '8080 Lunite', price: 5472 },
      ]},
  ]},
  { name: 'Honor of Kings', slug: 'honor-of-kings', categories: [
      { name: 'Token', group: 'main', fields: [{ label: 'Enter User ID' }], items: [
        { name: 'Weekly Card', price: 63 }, { name: 'Weekly Card Plus', price: 193 }, { name: '16 Tokens', price: 12 },
        { name: '23 Tokens', price: 20 }, { name: '80 Tokens', price: 56 }, { name: '240 Tokens', price: 161 },
        { name: '400 Tokens', price: 274 }, { name: '560 Tokens', price: 377 }, { name: '800 Tokens', price: 547 },
        { name: '1200 Tokens', price: 801 }, { name: '2400 Tokens', price: 1645 }, { name: '4000 Tokens', price: 2722 },
        { name: '8000 Tokens', price: 5728 },
      ]},
  ]},
  { name: 'League of Legends', slug: 'league-of-legends', categories: [
      { name: 'Core', group: 'main', fields: [{ label: 'UID' }], items: [
        { name: '575 Core', price: 212 }, { name: '1,380 Core', price: 477 }, { name: '2,800 Core', price: 898 },
        { name: '4,500 Core', price: 1479 }, { name: '6,500 Core', price: 2110 }, { name: '13,500 Core', price: 4238 },
      ]},
      { name: 'Riot Points Gift Card', group: 'others', fields: [{ label: 'UID' }], items: [
        { name: '430 RP', price: 150 }, { name: '730 RP', price: 250 },
        { name: '1,535 RP', price: 0, status: 'sold_out' }, { name: '2,325 RP', price: 0, status: 'sold_out' },
        { name: '3,985 RP', price: 1243 }, { name: '8,170 RP', price: 2467 },
      ]},
  ]},
  { name: 'Wild Rift', slug: 'wild-rift', categories: [
      { name: 'Core', group: 'main', fields: [{ label: 'UID' }], items: [
        { name: '452 Core', price: 200 }, { name: '1,000 Core', price: 454 }, { name: '1,850 Core', price: 822 },
        { name: '3,275 Core', price: 1445 }, { name: '4,800 Core', price: 2058 }, { name: '10,000 Core', price: 4110 },
      ]},
  ]},
  { name: 'Call of Duty Mobile', slug: 'cod-mobile', categories: [
    { name: 'Order', group: 'main', fields: [{ label: 'Enter UID' }], items: [] },
  ]},
];

const paymentMethods = [
  { name: 'GCash', accountName: 'J.K.C.', accountNumber: '09753914805' },
  { name: 'Maribank', accountName: 'J.K.C.', accountNumber: '14047002389' },
  { name: 'MAYA', accountName: 'H.P.', accountNumber: '09608276781' },
  { name: 'UNO', accountName: 'H.P.', accountNumber: '09911834065' },
];

const events = [
  {
    gameSlug: 'mlbb', categoryName: 'Event Skin Gifting', name: 'Jujutsu Kaisen', basePrice: 2149,
    start: '2026-08-18', end: '2026-10-15',
    heroes: [
      { heroName: 'Kagura', price: 2149 }, { heroName: 'Yu Zhong', price: 2149 },
      { heroName: 'Hayabusa', price: 2149 }, { heroName: 'Granger', price: 2149 },
    ],
    schedule: [
      { phaseName: '1st week', start: '2026-09-18', end: '2026-09-24', price: 2799 },
      { phaseName: 'Phase 1', start: '2026-09-25', end: '2026-10-01', price: 2799 },
      { phaseName: 'After Phase 1', start: '2026-10-02', end: '2026-10-08', price: 2799 },
      { phaseName: 'Last Day', start: '2026-10-09', end: '2026-10-09', price: 2799 },
    ],
  },
  {
    gameSlug: 'mlbb', categoryName: 'Event Skin Gifting', name: 'Exorcists', basePrice: 2799,
    start: '2026-09-01', end: '2026-10-09', heroes: [], schedule: [],
  },
];

async function main() {
  console.log('Clearing existing data...');
  await prisma.orderNote.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.order.deleteMany();
  await prisma.eventSchedule.deleteMany();
  await prisma.eventHero.deleteMany();
  await prisma.event.deleteMany();
  await prisma.pricelistItem.deleteMany();
  await prisma.formField.deleteMany();
  await prisma.category.deleteMany();
  await prisma.game.deleteMany();
  await prisma.paymentMethod.deleteMany();

  console.log('Inserting games, categories, form fields, pricelists...');
  for (const g of games) {
    const game = await prisma.game.create({ data: { name: g.name, slug: g.slug, description: g.description } });
    for (const c of g.categories) {
      const cat = await prisma.category.create({ data: { gameId: game.id, name: c.name, group: c.group } });
      for (const [i, f] of (c.fields ?? []).entries()) {
        await prisma.formField.create({ data: { categoryId: cat.id, label: f.label, helperText: f.helperText, sortOrder: i } });
      }
      for (const [i, it] of (c.items ?? []).entries()) {
        await prisma.pricelistItem.create({
          data: {
            categoryId: cat.id, name: it.name, price: it.price, originalPrice: it.originalPrice ?? null,
            status: it.status ?? 'available', notes: it.notes, sortOrder: i,
          },
        });
      }
    }
  }

  console.log('Inserting events...');
  for (const e of events) {
    const cat = await prisma.category.findFirst({ where: { name: e.categoryName, game: { slug: e.gameSlug } } });
    if (!cat) continue;
    const ev = await prisma.event.create({
      data: { categoryId: cat.id, name: e.name, basePrice: e.basePrice, startDate: new Date(e.start), endDate: new Date(e.end) },
    });
    for (const h of e.heroes) await prisma.eventHero.create({ data: { eventId: ev.id, heroName: h.heroName, price: h.price } });
    for (const s of e.schedule) {
      await prisma.eventSchedule.create({
        data: { eventId: ev.id, phaseName: s.phaseName, startDate: new Date(s.start), endDate: new Date(s.end), price: s.price },
      });
    }
  }

  console.log('Inserting payment methods...');
  for (const p of paymentMethods) await prisma.paymentMethod.create({ data: p });

  console.log('Ensuring default admin account...');
  const defaultPasswordHash = await bcrypt.hash('changeme123', 10);
  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash: defaultPasswordHash, role: 'super_admin' },
  });

  console.log('Seed complete ✅ — all 8 games, categories, pricelists, events, payment methods, and default admin inserted.');
}

main().finally(() => prisma.$disconnect());