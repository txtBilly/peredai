// Seed mock "in talks" listings so early visitors don't hit empty shelves.
//
// WHAT IT DOES
//   • Creates one verified mock lister (…@ten2ten.seed) per listing.
//   • Inserts listings with status='negotiating' (users can't Connect → no tokens spent).
//   • Uploads your photos to Supabase Storage and wires listing_photos.
//   • Moscow up to MSK_MAX (40), SPb up to SPB_MAX (30) — capped by how many
//     photo subfolders you provide.
//
// PHOTOS  (one subfolder per apartment; its images inside)
//   seed-photos/moscow/<anything>/*.jpg|jpeg|png|webp
//   seed-photos/spb/<anything>/*.jpg|jpeg|png|webp
//
// RUN (from the repo root, where node_modules has @supabase/supabase-js)
//   SUPABASE_URL="https://<ref>.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="<service_role_key>" \
//   node scripts/seed-listings.mjs
//
// PURGE everything this script created (listers + listings + photos + storage):
//   … same env … node scripts/seed-listings.mjs --purge
//
// NOTE: seed data only. Remove before/at launch. Add `seed-photos/` to .gitignore.

import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}
const BUCKET = 'listing-photos';
const SEED_DOMAIN = 'ten2ten.seed';
const MSK_MAX = Number(process.env.MSK_MAX ?? 40);
const SPB_MAX = Number(process.env.SPB_MAX ?? 30);

const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// ---------- reference data ----------
// Neighborhood → real, geographically-correct metro stations for that district,
// so cross_streets never puts e.g. м. Крылатское in Царицыно. Pick a district,
// then a station from its own list.
const MSK_NB = {
  'Хамовники': ['Парк культуры', 'Фрунзенская', 'Спортивная'],
  'Пресненский': ['Улица 1905 года', 'Краснопресненская', 'Баррикадная'],
  'Арбат': ['Смоленская', 'Арбатская', 'Кропоткинская'],
  'Тверской': ['Тверская', 'Маяковская', 'Чеховская'],
  'Замоскворечье': ['Новокузнецкая', 'Третьяковская', 'Павелецкая'],
  'Якиманка': ['Полянка', 'Октябрьская', 'Шаболовская'],
  'Раменки': ['Университет', 'Ломоносовский проспект', 'Мичуринский проспект'],
  'Тимирязевский': ['Тимирязевская', 'Дмитровская'],
  'Сокол': ['Сокол', 'Аэропорт'],
  'Аэропорт': ['Аэропорт', 'Динамо'],
  'Марьина Роща': ['Марьина Роща', 'Достоевская'],
  'Басманный': ['Курская', 'Бауманская', 'Красные Ворота'],
  'Таганский': ['Таганская', 'Марксистская', 'Пролетарская'],
  'Мещанский': ['Проспект Мира', 'Сухаревская', 'Цветной бульвар'],
  'Дорогомилово': ['Киевская', 'Студенческая'],
  'Останкинский': ['ВДНХ', 'Алексеевская'],
  'Академический': ['Академическая', 'Профсоюзная'],
  'Гагаринский': ['Ленинский проспект', 'Университет'],
  'Донской': ['Шаболовская', 'Ленинский проспект'],
  'Даниловский': ['Тульская', 'Автозаводская'],
  'Лефортово': ['Авиамоторная', 'Бауманская'],
  'Сокольники': ['Сокольники', 'Красносельская'],
  'Измайлово': ['Партизанская', 'Измайловская', 'Первомайская'],
  'Кузьминки': ['Кузьминки', 'Рязанский проспект'],
  'Отрадное': ['Отрадное', 'Владыкино'],
  'Митино': ['Митино', 'Волоколамская'],
  'Строгино': ['Строгино', 'Мякинино'],
  'Крылатское': ['Крылатское', 'Молодёжная'],
  'Фили-Давыдково': ['Пионерская', 'Филёвский парк', 'Багратионовская'],
  'Кунцево': ['Кунцевская', 'Молодёжная'],
  'Черёмушки': ['Новые Черёмушки', 'Профсоюзная'],
  'Коньково': ['Коньково', 'Беляево'],
  'Ясенево': ['Ясенево', 'Тёплый Стан', 'Новоясеневская'],
  'Чертаново Северное': ['Чертановская', 'Южная'],
  'Царицыно': ['Царицыно', 'Кантемировская'],
  'Люблино': ['Люблино', 'Волжская'],
};
const SPB_NB = {
  'Центральный': ['Маяковская', 'Площадь Восстания', 'Гостиный двор', 'Владимирская'],
  'Адмиралтейский': ['Садовая', 'Сенная площадь', 'Технологический институт'],
  'Петроградский': ['Петроградская', 'Горьковская', 'Чкаловская', 'Спортивная'],
  'Василеостровский': ['Василеостровская', 'Приморская'],
  'Московский': ['Московские ворота', 'Электросила', 'Парк Победы', 'Московская'],
  'Приморский': ['Комендантский проспект', 'Старая Деревня', 'Пионерская'],
  'Выборгский': ['Выборгская', 'Лесная', 'Площадь Мужества'],
  'Калининский': ['Академическая', 'Гражданский проспект', 'Политехническая'],
  'Фрунзенский': ['Фрунзенская', 'Обводный канал', 'Международная'],
  'Невский': ['Ломоносовская', 'Пролетарская', 'Елизаровская'],
  'Красногвардейский': ['Новочеркасская', 'Ладожская'],
  'Кировский': ['Кировский завод', 'Автово', 'Нарвская'],
};
const FIRST_M = ['Иван','Дмитрий','Алексей','Сергей','Андрей','Михаил','Николай','Павел','Артём','Максим','Роман','Егор'];
const FIRST_F = ['Анна','Мария','Елена','Ольга','Наталья','Ирина','Екатерина','Татьяна','Светлана','Юлия','Дарья','Ксения'];
const LAST_M = ['Смирнов','Ковалёв','Соколов','Волков','Морозов','Новиков','Фёдоров','Попов','Лебедев','Козлов','Егоров','Орлов'];
const LAST_F = ['Смирнова','Ковалёва','Соколова','Волкова','Морозова','Новикова','Фёдорова','Попова','Лебедева','Козлова','Егорова','Орлова'];
const TYPES = ['room','studio','1br','2br','3br_plus'];
const TYPE_W = ['room','studio','studio','1br','1br','1br','2br','2br','3br_plus']; // weighted pool

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const chance = (p) => Math.random() < p;
const round10k = (n) => Math.round(n / 10000) * 10000;
const round1000 = (n) => Math.round(n / 1000) * 1000;

// Moscow rent ranges, capped at 110 000 ₽ (no more 360k outliers). SPb is
// scaled to 0.82 below, so it lands lower still.
function rentFor(type, spb) {
  const base = {
    room: [25000, 45000], studio: [40000, 65000], '1br': [55000, 85000],
    '2br': [70000, 105000], '3br_plus': [90000, 110000],
  }[type];
  let v = randInt(base[0], base[1]);
  if (spb) v = Math.round(v * 0.82);
  return round10k(v); // rents in 10 000 ₽ steps
}

// Gratuity ("благодарность") is 30–50% of the monthly rent, rounded to 1 000 ₽.
function gratuityFor(rent) {
  return round1000(rent * (0.3 + Math.random() * 0.2));
}
function sqftFor(type) {
  return { room: [12, 20], studio: [22, 38], '1br': [33, 52], '2br': [50, 82], '3br_plus': [80, 145] }[type];
}
function bathroomsFor(type) {
  if (type === '2br') return chance(0.4) ? 2 : 1;
  if (type === '3br_plus') return rnd([2, 2, 3]);
  return 1;
}
function availableFrom() {
  // Always in the future (2–60 days out); some within 5 days → "soon" gradient
  // badge. A daily pg_cron (see refresh_seed_availability) keeps these rolling
  // forward so seed dates never go stale.
  const soon = chance(0.22);
  const d = new Date();
  d.setDate(d.getDate() + (soon ? randInt(2, 4) : randInt(8, 60)));
  return d.toISOString().slice(0, 10);
}
function personName() {
  return chance(0.5)
    ? { full: `${rnd(FIRST_M)} ${rnd(LAST_M)}`, first: null }
    : { full: `${rnd(FIRST_F)} ${rnd(LAST_F)}`, first: null };
}
// Feminine-noun label per type so a feminine adjective ("Уютная …") always agrees.
const TYPE_NOUN = {
  room: 'комната',
  studio: 'студия',
  '1br': 'однокомнатная квартира',
  '2br': 'двухкомнатная квартира',
  '3br_plus': 'трёхкомнатная квартира',
};
const DESC_ADJ = ['Светлая', 'Уютная', 'Просторная', 'Тёплая', 'Стильная', 'Современная', 'Тихая'];
const DESC_CLOSING = [
  'Тихий двор и развитая инфраструктура рядом.',
  'Рядом магазины, кафе и парки — всё для комфортной жизни.',
  'Документы готовы, заселение в удобную дату.',
  'Отличный вариант для долгосрочной аренды.',
  'Свежий ремонт, всё необходимое для заезда уже есть.',
  'Продумана каждая деталь — можно въезжать с чемоданом.',
];

// Brief 2–3 sentence Russian blurb for the Description field. Returns null ~20%
// of the time so not every card is described. `metro` is the bare station name.
function describe(type, neighborhood, metro, l) {
  if (chance(0.2)) return null;
  const parts = [`${rnd(DESC_ADJ)} ${TYPE_NOUN[type]} в районе ${neighborhood}.`];
  parts.push(`До метро ${metro} — ${randInt(3, 15)} минут пешком.`);
  const feats = [];
  if (l.laundry) feats.push('есть стиральная машина');
  if (l.elevator) feats.push('в доме лифт');
  if (l.outdoor) feats.push('есть балкон');
  if (l.doorman) feats.push('консьерж в подъезде');
  if (l.pets_ok) feats.push('можно с животными');
  if (feats.length) {
    const pick = feats.sort(() => Math.random() - 0.5).slice(0, 2);
    parts.push(pick.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.');
  }
  parts.push(rnd(DESC_CLOSING));
  return parts.join(' ');
}

const SLOTS = ['bedroom', 'kitchen', 'bathroom'];

// Detect image type from the file's bytes (not its name) — cian/avito downloads
// often have hashed, extension-less filenames. Returns null for non-images.
function sniff(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: '.jpg', contentType: 'image/jpeg' };
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: '.png', contentType: 'image/png' };
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: '.webp', contentType: 'image/webp' };
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'GIF8') return { ext: '.gif', contentType: 'image/gif' };
  return null;
}

async function listApartmentFolders(city) {
  const root = path.join('seed-photos', city);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    console.warn(`(no ${root} folder — skipping ${city})`);
    return [];
  }
  const out = [];
  for (const e of entries.filter((x) => x.isDirectory())) {
    const dir = path.join(root, e.name);
    const imgs = (await readdir(dir))
      .filter((f) => !f.startsWith('.') && !f.endsWith('~')) // skip .DS_Store + mogrify ~backups; type-checked by bytes later
      .sort()
      .map((f) => path.join(dir, f));
    if (imgs.length) out.push(imgs);
  }
  return out;
}

async function seedCity(cityLabel, folderKey, nbMap, max) {
  const neighborhoods = Object.keys(nbMap);
  const folders = (await listApartmentFolders(folderKey)).slice(0, max);
  console.log(`\n${cityLabel}: ${folders.length} apartment folder(s) found (cap ${max}).`);
  let i = 0;
  for (const imgs of folders) {
    i++;
    const tag = `${folderKey}-${String(i).padStart(2, '0')}`;
    const email = `seed-${tag}@${SEED_DOMAIN}`;
    const nm = personName();

    // 1) mock lister (verified)
    const { data: created, error: cErr } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: nm.full, display_first_name: nm.full.split(' ')[0], preferred_locale: 'ru', spoken_languages: ['ru'] },
    });
    if (cErr || !created?.user) { console.error(`  ✗ ${tag} createUser:`, cErr?.message); continue; }
    const listerId = created.user.id;
    await sb.from('profiles').update({
      verification_status: 'verified',
      identity_verified_at: new Date().toISOString(),
      spoken_languages: chance(0.4) ? ['ru', rnd(['en', 'uz', 'tg'])] : ['ru'],
    }).eq('id', listerId);

    // 2) listing (negotiating)
    const type = rnd(TYPE_W);
    const spb = folderKey === 'spb';
    const [slo, shi] = sqftFor(type);
    const elevator = chance(0.6);
    const neighborhood = rnd(neighborhoods);
    const metro = rnd(nbMap[neighborhood]); // a station that actually serves this district
    const rent = rentFor(type, spb);
    const listing = {
      lister_id: listerId,
      status: 'negotiating',
      city: cityLabel,
      neighborhood,
      cross_streets: `м. ${metro}`,
      type,
      monthly_rent: rent,
      sqft: randInt(slo, shi),
      bathrooms: bathroomsFor(type),
      available_from: availableFrom(),
      elevator,
      walk_up: !elevator && chance(0.5),
      laundry: chance(0.7),
      pets_ok: chance(0.3),
      doorman: chance(0.25),
      outdoor: chance(0.35),
      no_fee: true,
      allow_non_rf: chance(0.5),
      allow_children: chance(0.65),
      gratitude_amount: gratuityFor(rent), // 30–50% of rent, rounded to 1 000 ₽
      published_at: new Date().toISOString(),
    };
    listing.description = describe(type, neighborhood, metro, listing); // ~80% get a blurb
    const { data: row, error: lErr } = await sb.from('listings').insert(listing).select('id').single();
    if (lErr || !row) { console.error(`  ✗ ${tag} listing:`, lErr?.message); continue; }
    const listingId = row.id;

    // 3) photos → storage + listing_photos (type detected from bytes)
    const photoRows = [];
    for (const file of imgs) {
      const buf = await readFile(file);
      const kind = sniff(buf);
      if (!kind) { console.warn(`  · ${tag} skip non-image ${path.basename(file)}`); continue; }
      const idx = photoRows.length;
      const slot = SLOTS[idx] ?? 'extra';
      const key = `${listingId}/${slot}-${idx}${kind.ext}`;
      const { error: uErr } = await sb.storage.from(BUCKET).upload(key, buf, { contentType: kind.contentType, upsert: true });
      if (uErr) { console.error(`  · ${tag} photo ${idx}:`, uErr.message); continue; }
      photoRows.push({ listing_id: listingId, storage_path: key, slot, sort_order: idx });
    }
    if (photoRows.length === 0) {
      // No usable images — roll back so there's no empty-card listing.
      await sb.from('listings').delete().eq('id', listingId);
      await sb.auth.admin.deleteUser(listerId);
      console.warn(`  · ${tag} removed (no usable images in folder)`);
      i--;
      continue;
    }
    await sb.from('listing_photos').insert(photoRows);

    console.log(`  ✓ ${tag}  ${type} · ${listing.neighborhood} · ${listing.monthly_rent}₽ · ${photoRows.length} photo(s)`);
  }
  return i;
}

async function purge() {
  console.log('Purging seed data (…@' + SEED_DOMAIN + ') …');
  let removedUsers = 0, page = 1;
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error(error.message); break; }
    const seeds = data.users.filter((u) => (u.email ?? '').endsWith('@' + SEED_DOMAIN));
    for (const u of seeds) {
      // storage: remove every listing folder owned by this lister
      const { data: ls } = await sb.from('listings').select('id').eq('lister_id', u.id);
      for (const l of ls ?? []) {
        const { data: files } = await sb.storage.from(BUCKET).list(l.id);
        if (files?.length) await sb.storage.from(BUCKET).remove(files.map((f) => `${l.id}/${f.name}`));
      }
      await sb.auth.admin.deleteUser(u.id); // cascades profiles → listings → listing_photos
      removedUsers++;
    }
    if (data.users.length < 200) break;
    page++;
  }
  console.log(`Removed ${removedUsers} seed lister(s) and their listings/photos.`);
}

async function main() {
  if (process.argv.includes('--purge')) { await purge(); return; }
  const msk = await seedCity('Москва', 'moscow', MSK_NB, MSK_MAX);
  const spb = await seedCity('Санкт-Петербург', 'spb', SPB_NB, SPB_MAX);
  console.log(`\nDone. Seeded ${msk} Moscow + ${spb} SPb listings (status=negotiating).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
