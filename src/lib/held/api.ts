import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { categoryFromSlug, categorySlug, isCategory, normName, slugify } from "./format";
import type {
  ActionResult,
  Card,
  Category,
  KitItem,
  ListDetail,
  LiveFeature,
  PersonProfile,
  PreviewResult,
  ProductDetail,
  ProductStatus,
  RejectReason,
  ReviewItem,
  SessionPerson,
  SortKey,
  TextRow,
  AdminData,
  AdminEditItem,
  AdminHost,
  AdminLiveItem,
} from "./types";
import { CATEGORIES, REJECT_REASONS } from "./types";
import { canonicalUrl, isAllowlisted } from "./url";

async function db() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

type CardRow = {
  slug: string;
  name: string;
  photo: string;
  price: number | string;
  category: string;
  featured: boolean | string | number;
  price_noted_on: string | Date;
  official_host: string;
  brand_name: string;
  brand_slug: string;
  handle: string;
  person_name: string;
  bio: string | null;
  city: string | null;
  holder_count: number | string;
  note: string | null;
};

function num(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

function flag(value: unknown) {
  return value === true || value === "t" || value === 1 || value === "1";
}

function day(value: unknown) {
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function mapCard(row: CardRow, hosts: string[]): Card {
  return {
    slug: row.slug,
    name: row.name,
    photo: row.photo,
    price: num(row.price),
    category: row.category,
    brandName: row.brand_name,
    brandSlug: row.brand_slug,
    officialHost: row.official_host,
    official: isAllowlisted(row.official_host, hosts),
    featured: flag(row.featured),
    notedOn: day(row.price_noted_on),
    credit: {
      handle: row.handle,
      name: row.person_name,
      bio: row.bio ?? "",
      city: row.city ?? "",
    },
    extraHolders: Math.max(0, num(row.holder_count) - 1),
    note: row.note || undefined,
  };
}

async function allowHosts(sql: Sql) {
  const rows = await sql<{ host: string }>`select host from allowlist`;
  return rows.map((row) => row.host);
}

type CardOpts = {
  category?: string;
  brandSlug?: string;
  personHandle?: string;
  listSlug?: string;
  excludeSlug?: string;
  sort?: SortKey | "position" | "recent-use";
  limit?: number;
};

async function loadCards(sql: Sql, hosts: string[], opts: CardOpts) {
  const where = ["p.status = 'live'"];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace("$?", `$${params.length}`));
  };
  if (opts.category) add("p.category = $?", opts.category);
  if (opts.brandSlug) add("b.slug = $?", opts.brandSlug);
  if (opts.excludeSlug) add("p.slug <> $?", opts.excludeSlug);
  let joins = "";
  let noteSelect = "null::text as note";
  let order = "p.featured desc, p.price_noted_on desc, p.name asc";
  if (opts.sort === "newest") order = "p.price_noted_on desc, p.name asc";
  if (opts.sort === "price") order = "p.price asc, p.name asc";
  if (opts.personHandle) {
    joins += " join uses mine on mine.product_id = p.id join people owner on owner.id = mine.person_id";
    add("owner.handle = $?", opts.personHandle);
    noteSelect = "mine.note as note";
    order = "mine.created_at desc";
  }
  if (opts.listSlug) {
    joins += " join list_products lp on lp.product_id = p.id join lists l on l.id = lp.list_id";
    add("l.slug = $?", opts.listSlug);
    order = "lp.position asc";
  }
  let limitSql = "";
  if (opts.limit) {
    params.push(opts.limit);
    limitSql = `limit $${params.length}`;
  }
  const text = `
    select p.slug, p.name, p.photo, p.price, p.category, p.featured, p.price_noted_on, p.official_host,
      b.name as brand_name, b.slug as brand_slug,
      pe.handle, pe.name as person_name, pe.bio, pe.city,
      (select count(*) from uses uh where uh.product_id = p.id) as holder_count,
      ${noteSelect}
    from products p
    join brands b on b.id = p.brand_id
    join people pe on pe.id = p.introduced_by
    ${joins}
    where ${where.join(" and ")}
    order by ${order}
    ${limitSql}
  `;
  const rows = await sql.query<CardRow>(text, params);
  return rows.map((row) => mapCard(row, hosts));
}

async function categoryCounts(sql: Sql) {
  const rows = await sql<{ category: string; n: number }>`
    select category, count(*) as n from products where status = 'live' group by category
  `;
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.category] = num(row.n);
  return counts;
}

function isUnique(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|duplicate/i.test(message);
}

async function ensureBrand(sql: Sql, name: string, domain: string | null) {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 40);
  const slug = slugify(clean);
  if (clean.length < 2 || !slug) return null;
  const found = await sql<{ id: string }>`select id from brands where slug = ${slug} limit 1`;
  if (found[0]) return found[0].id;
  try {
    await sql`insert into brands (id, name, slug, official_domain) values (${slug}, ${clean}, ${slug}, ${domain})`;
  } catch (error) {
    if (!isUnique(error)) throw error;
  }
  const again = await sql<{ id: string }>`select id from brands where slug = ${slug} limit 1`;
  return again[0]?.id ?? null;
}

async function findDuplicate(sql: Sql, nameNorm: string, brandId: string, canon: string, exceptId = "") {
  const rows = await sql<{ slug: string; status: ProductStatus }>`
    select slug, status from products
    where (${exceptId} = '' or id <> ${exceptId})
      and (canonical_url = ${canon} or (name_norm = ${nameNorm} and brand_id = ${brandId}))
    limit 1
  `;
  return rows[0] ?? null;
}

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

function cleanNote(note: string): Checked<string> {
  const value = note.trim();
  if (value.length < 40 || value.length > 280) return { ok: false, error: "Note must be 40–280 characters." };
  return { ok: true, value };
}

function cleanYear(year: unknown): Checked<number | null> {
  if (year === null || year === undefined || year === "") return { ok: true, value: null };
  const parsed = typeof year === "number" ? year : Number(year);
  if (!Number.isInteger(parsed) || parsed < 1970 || parsed > 2026) {
    return { ok: false, error: "Year should be between 1970 and 2026." };
  }
  return { ok: true, value: parsed };
}

function cleanPhoto(photo: string, required: boolean): Checked<string> {
  if (!photo) return required ? { ok: false, error: "Add one photo." } : { ok: true, value: "" };
  if (photo.startsWith("/photos/")) return { ok: true, value: photo };
  if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(photo)) {
    return { ok: false, error: "Use a JPEG, PNG, or WebP." };
  }
  if (photo.length > 1_800_000) return { ok: false, error: "Use a smaller photo." };
  return { ok: true, value: photo };
}

function cleanWhat(what: string): Checked<string> {
  const value = what.trim();
  if (!value || value.length > 140) return { ok: false, error: "Say what it is, in 140 characters." };
  return { ok: true, value };
}

function cleanPrice(price: unknown): Checked<number> {
  const parsed = typeof price === "number" ? price : Number(price);
  if (!Number.isInteger(parsed) || parsed <= 0) return { ok: false, error: "Price should be a whole number in IDR." };
  return { ok: true, value: parsed };
}

function cleanName(name: string): Checked<string> {
  const value = name.trim().replace(/\s+/g, " ");
  if (value.length < 2 || value.length > 80) return { ok: false, error: "Name should be 2–80 characters." };
  return { ok: true, value };
}

type PersonRow = { id: string; handle: string; name: string; role: "member" | "editor"; demo_seeded: boolean };

async function seedDemoKit(sql: Sql, userId: string) {
  const samples = [
    {
      slug: "stone-tray",
      name: "Stone Tray",
      brand: "Hemlock",
      domain: "hemlockobjects.com",
      category: "Home",
      photo: "/photos/stone-tray.jpg",
      what: "A small stone tray for keys and a pen.",
      price: 890000,
      url: "https://hemlockobjects.com/stone-tray",
      status: "in_review" as const,
      reject: null as string | null,
      note: "It sits under the keys. I want a place that is not another dish from the kitchen.",
      year: 2025,
    },
    {
      slug: "charge-cable",
      name: "Charge Cable",
      brand: "Fieldline",
      domain: "fieldline.studio",
      category: "Tech",
      photo: "/photos/wrong-cup.jpg",
      what: "A short charge cable for the desk.",
      price: 240000,
      url: "https://fieldline.studio/charge-cable",
      status: "needs_edit" as const,
      reject: "photo is not the product",
      note: "I use the short one, not a spare from a drawer. The photo on this submission is wrong and needs a retake.",
      year: 2024,
    },
  ];
  for (const sample of samples) {
    const exists = await sql<{ id: string }>`select id from products where id = ${sample.slug} limit 1`;
    if (exists.length) continue;
    const parsed = canonicalUrl(sample.url);
    if (!parsed.ok) continue;
    const brandId = await ensureBrand(sql, sample.brand, sample.domain);
    if (!brandId) continue;
    await sql`
      insert into products (
        id, slug, name, name_norm, brand_id, category, photo, what_it_is, price, price_noted_on,
        official_url, official_host, canonical_url, status, introduced_by, featured, ever_live, reject_reason
      ) values (
        ${sample.slug}, ${sample.slug}, ${sample.name}, ${normName(sample.name)}, ${brandId}, ${sample.category},
        ${sample.photo}, ${sample.what}, ${sample.price}, ${"2026-10-24"},
        ${parsed.url}, ${parsed.host}, ${parsed.url}, ${sample.status}, ${userId}, false, false, ${sample.reject}
      )
    `;
    await sql`
      insert into uses (id, person_id, product_id, note, since_year, status)
      values (${crypto.randomUUID()}, ${userId}, ${sample.slug}, ${sample.note}, ${sample.year}, ${sample.status})
    `;
  }
}

async function ensurePerson(sql: Sql, userId: string, name: string): Promise<SessionPerson> {
  const existing = await sql<PersonRow>`
    select id, handle, name, role, demo_seeded from people where id = ${userId} limit 1
  `;
  if (existing[0]) {
    if (!existing[0].demo_seeded) {
      await seedDemoKit(sql, userId);
      await sql`update people set demo_seeded = true where id = ${userId}`;
    }
    return {
      id: existing[0].id,
      handle: existing[0].handle,
      name: existing[0].name,
      role: existing[0].role,
    };
  }
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 80) || "Member";
  const base = slugify(clean) || "member";
  let handle = base.slice(0, 28);
  let n = 2;
  while ((await sql`select id from people where handle = ${handle} limit 1`).length) {
    handle = `${base.slice(0, 22)}-${n++}`;
  }
  const editors = await sql<{ n: number }>`
    select count(*) as n from people where role = 'editor' and id not like 'seed-%'
  `;
  const role = num(editors[0]?.n) === 0 ? "editor" : "member";
  try {
    await sql`
      insert into people (id, handle, name, bio, city, role, demo_seeded)
      values (${userId}, ${handle}, ${clean}, '', '', ${role}, false)
    `;
  } catch (error) {
    if (!isUnique(error)) throw error;
    const raced = await sql<PersonRow>`select id, handle, name, role from people where id = ${userId} limit 1`;
    if (raced[0]) return raced[0];
    throw error;
  }
  await seedDemoKit(sql, userId);
  await sql`update people set demo_seeded = true where id = ${userId}`;
  return { id: userId, handle, name: clean, role };
}

async function requireEditor(sql: Sql, userId: string) {
  const rows = await sql<{ role: string }>`select role from people where id = ${userId} limit 1`;
  return rows[0]?.role === "editor";
}

async function uniqueSlug(sql: Sql, base: string) {
  const root = base || "product";
  let slug = root;
  let n = 2;
  while ((await sql`select id from products where slug = ${slug} limit 1`).length) {
    slug = `${root.slice(0, 54)}-${n++}`;
  }
  return slug;
}

export const syncPerson = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name?: string }) => ({ name: String(input?.name ?? "") }))
  .handler(async ({ data, context }) => {
    const sql = await db();
    return ensurePerson(sql, context.userId, data.name);
  });

export const getDiscover = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const hosts = await allowHosts(sql);
  const [categoryRows, photoRows, brandRows, listRows, shotRows, products] = await Promise.all([
    sql<{ name: string; count: number }>`
      select category as name, count(*) as count
      from products
      where status = 'live'
      group by category
    `,
    sql<{ category: string; photo: string }>`
      select distinct on (category) category, photo
      from products
      where status = 'live'
      order by category, featured desc, price_noted_on desc
    `,
    sql<{ slug: string; name: string; count: number }>`
      select b.slug, b.name, count(p.id) as count
      from brands b
      join products p on p.brand_id = b.id and p.status = 'live'
      group by b.id
      order by count(p.id) desc, b.name asc
      limit 8
    `,
    sql<{ slug: string; name: string; count: number }>`
      select l.slug, l.title as name,
        (select count(*) from list_products lp
          join products p on p.id = lp.product_id
          where lp.list_id = l.id and p.status = 'live') as count
      from lists l
      order by l.title asc
    `,
    sql<{ slug: string; photo: string }>`
      select l.slug, p.photo
      from lists l
      join list_products lp on lp.list_id = l.id
      join products p on p.id = lp.product_id and p.status = 'live'
      order by l.slug, lp.position asc
    `,
    loadCards(sql, hosts, { sort: "newest", limit: 8 }),
  ]);
  const photos = new Map(photoRows.map((row) => [row.category, row.photo]));
  const shots = new Map<string, string[]>();
  for (const row of shotRows) {
    const list = shots.get(row.slug) ?? [];
    if (list.length < 4) list.push(row.photo);
    shots.set(row.slug, list);
  }
  const order = new Map<string, number>(CATEGORIES.map((name, index) => [name, index]));
  const categories = categoryRows
    .map((row) => ({
      slug: categorySlug(row.name),
      name: row.name,
      count: num(row.count),
      photo: photos.get(row.name) ?? "",
    }))
    .filter((row) => row.count > 0 && row.photo)
    .sort((a, b) => (order.get(a.name) ?? 99) - (order.get(b.name) ?? 99));
  return {
    categories,
    brands: brandRows.map((row) => ({ slug: row.slug, name: row.name, count: num(row.count) })),
    lists: listRows
      .map((row) => ({
        slug: row.slug,
        name: row.name,
        count: num(row.count),
        photos: shots.get(row.slug) ?? [],
      }))
      .filter((row) => row.count > 0),
    products: products.map((item) => ({
      slug: item.slug,
      name: item.name,
      brandName: item.brandName,
      photo: item.photo,
    })),
  };
});

export const listProducts = createServerFn({ method: "GET" })
  .validator((input: { category?: string; sort?: string }) => {
    const category = input?.category && isCategory(input.category) ? input.category : "all";
    const sort: SortKey = input?.sort === "newest" || input?.sort === "price" ? input.sort : "featured";
    return { category, sort };
  })
  .handler(async ({ data }) => {
    const sql = await db();
    const hosts = await allowHosts(sql);
    const counts = await categoryCounts(sql);
    const items = await loadCards(sql, hosts, {
      category: data.category === "all" ? undefined : data.category,
      sort: data.sort,
    });
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    return { items, counts, total, category: data.category, sort: data.sort };
  });

export const getProduct = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const sql = await db();
    const hosts = await allowHosts(sql);
    const rows = await sql<{
      slug: string;
      name: string;
      photo: string;
      price: number;
      price_noted_on: string;
      category: string;
      what_it_is: string;
      official_url: string;
      official_host: string;
      featured: boolean;
      introduced_by: string;
      brand_name: string;
      brand_slug: string;
      handle: string;
      person_name: string;
      bio: string;
      city: string;
    }>`
      select p.slug, p.name, p.photo, p.price, p.price_noted_on, p.category, p.what_it_is,
        p.official_url, p.official_host, p.featured, p.introduced_by,
        b.name as brand_name, b.slug as brand_slug,
        pe.handle, pe.name as person_name, pe.bio, pe.city
      from products p
      join brands b on b.id = p.brand_id
      join people pe on pe.id = p.introduced_by
      where p.slug = ${slug} and p.status = 'live'
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    const uses = await sql<{
      handle: string;
      name: string;
      bio: string;
      city: string;
      note: string;
      since_year: number | null;
      person_id: string;
    }>`
      select pe.handle, pe.name, pe.bio, pe.city, u.note, u.since_year, u.person_id
      from uses u
      join people pe on pe.id = u.person_id
      where u.product_id = ${slug}
      order by (u.person_id = ${row.introduced_by}) desc, u.created_at asc
    `;
    const primary = uses.find((use) => use.person_id === row.introduced_by) ?? null;
    const holders = uses
      .filter((use) => use.person_id !== row.introduced_by)
      .map((use) => ({ handle: use.handle, name: use.name, bio: use.bio, city: use.city }));
    const [moreFromPerson, moreInCategory] = await Promise.all([
      loadCards(sql, hosts, { personHandle: row.handle, excludeSlug: slug, limit: 4 }),
      loadCards(sql, hosts, { category: row.category, excludeSlug: slug, sort: "featured", limit: 4 }),
    ]);
    const detail: ProductDetail = {
      slug: row.slug,
      name: row.name,
      photo: row.photo,
      price: num(row.price),
      notedOn: day(row.price_noted_on),
      category: row.category,
      brandName: row.brand_name,
      brandSlug: row.brand_slug,
      officialHost: row.official_host,
      officialUrl: row.official_url,
      official: isAllowlisted(row.official_host, hosts),
      what: row.what_it_is,
      featured: flag(row.featured),
      note: primary?.note ?? null,
      sinceYear: primary?.since_year ?? null,
      credit: { handle: row.handle, name: row.person_name, bio: row.bio ?? "", city: row.city ?? "" },
      holders,
      moreFromPerson,
      moreInCategory,
    };
    return detail;
  });

export const listPeople = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const rows = await sql<TextRow & { handle: string }>`
    select pe.handle as slug, pe.name, count(p.id) as count
    from people pe
    join uses u on u.person_id = pe.id
    join products p on p.id = u.product_id and p.status = 'live'
    group by pe.id
    order by pe.name asc
  `;
  return rows.map((row) => ({ slug: row.slug, name: row.name, count: num(row.count) }));
});

export const getPerson = createServerFn({ method: "GET" })
  .validator((handle: string) => handle)
  .handler(async ({ data: handle }) => {
    const sql = await db();
    const hosts = await allowHosts(sql);
    const people = await sql<{ handle: string; name: string; bio: string; city: string }>`
      select handle, name, bio, city from people where handle = ${handle} limit 1
    `;
    const person = people[0];
    if (!person) return null;
    const items = await loadCards(sql, hosts, { personHandle: handle });
    const profile: PersonProfile = { ...person, count: items.length, items };
    return profile;
  });

export const listBrands = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const rows = await sql<{ slug: string; name: string; count: number }>`
    select b.slug, b.name, count(p.id) as count
    from brands b
    join products p on p.brand_id = b.id and p.status = 'live'
    group by b.id
    order by b.name asc
  `;
  return rows.map((row) => ({ slug: row.slug, name: row.name, count: num(row.count) }));
});

export const getBrand = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const sql = await db();
    const hosts = await allowHosts(sql);
    const brands = await sql<{ name: string; slug: string; official_domain: string | null }>`
      select name, slug, official_domain from brands where slug = ${slug} limit 1
    `;
    const brand = brands[0];
    if (!brand) return null;
    const items = await loadCards(sql, hosts, { brandSlug: slug, sort: "featured" });
    return { ...brand, items };
  });

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const counts = await categoryCounts(sql);
  return CATEGORIES.map((name) => ({
    slug: name.toLowerCase(),
    name,
    count: counts[name] ?? 0,
  }));
});

export const getCategory = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const category = categoryFromSlug(slug);
    if (!category) return null;
    const sql = await db();
    const hosts = await allowHosts(sql);
    const items = await loadCards(sql, hosts, { category, sort: "featured" });
    return { name: category, slug: category.toLowerCase(), items };
  });

export const listLists = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const rows = await sql<{ slug: string; name: string; count: number }>`
    select l.slug, l.title as name,
      (select count(*) from list_products lp
        join products p on p.id = lp.product_id
        where lp.list_id = l.id and p.status = 'live') as count
    from lists l
    order by l.title asc
  `;
  return rows.map((row) => ({ slug: row.slug, name: row.name, count: num(row.count) }));
});

export const getList = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const sql = await db();
    const hosts = await allowHosts(sql);
    const lists = await sql<{
      slug: string;
      title: string;
      sentence: string;
      author_name: string;
      author_handle: string;
    }>`
      select l.slug, l.title, l.sentence, pe.name as author_name, pe.handle as author_handle
      from lists l
      join people pe on pe.id = l.author_id
      where l.slug = ${slug}
      limit 1
    `;
    const list = lists[0];
    if (!list) return null;
    const items = await loadCards(sql, hosts, { listSlug: slug });
    const detail: ListDetail = {
      slug: list.slug,
      title: list.title,
      sentence: list.sentence,
      authorName: list.author_name,
      authorHandle: list.author_handle,
      items,
    };
    return detail;
  });

export const searchLive = createServerFn({ method: "GET" })
  .validator((query: string) => String(query ?? "").trim().slice(0, 80))
  .handler(async ({ data: query }) => {
    if (query.length < 2) return [];
    const sql = await db();
    const like = `%${query.replace(/[%_\\]/g, "")}%`;
    return sql<{ slug: string; name: string; brand_name: string }>`
      select p.slug, p.name, b.name as brand_name
      from products p
      join brands b on b.id = p.brand_id
      where p.status = 'live' and (p.name ilike ${like} or b.name ilike ${like})
      order by p.name asc
      limit 8
    `;
  });

export const previewProduct = createServerFn({ method: "GET" })
  .validator((input: { name?: string; brand?: string; url?: string }) => ({
    name: String(input?.name ?? ""),
    brand: String(input?.brand ?? ""),
    url: String(input?.url ?? ""),
  }))
  .handler(async ({ data }): Promise<PreviewResult> => {
    const parsed = canonicalUrl(data.url);
    if (!parsed.ok) {
      return { urlError: parsed.reason, host: null, official: false, taken: false, live: false };
    }
    const sql = await db();
    const hosts = await allowHosts(sql);
    const byUrl = await sql<{ slug: string; status: ProductStatus }>`
      select slug, status from products where canonical_url = ${parsed.url} limit 1
    `;
    let row = byUrl[0];
    if (!row && data.brand.trim()) {
      const brand = await sql<{ id: string }>`select id from brands where slug = ${slugify(data.brand)} limit 1`;
      if (brand[0] && data.name.trim()) {
        const dup = await sql<{ slug: string; status: ProductStatus }>`
          select slug, status from products
          where name_norm = ${normName(data.name)} and brand_id = ${brand[0].id}
          limit 1
        `;
        row = dup[0];
      }
    }
    return {
      urlError: null,
      host: parsed.host,
      official: isAllowlisted(parsed.host, hosts),
      taken: Boolean(row),
      live: row?.status === "live",
      duplicateSlug: row?.slug,
    };
  });

type IntroduceInput = {
  name: string;
  brand: string;
  category: string;
  url: string;
  price: number;
  photo: string;
  what: string;
  note: string;
  sinceYear: number | null;
  original: boolean;
  officialClaim: boolean;
  displayName: string;
};

function readIntroduce(input: IntroduceInput): IntroduceInput {
  return {
    name: String(input?.name ?? ""),
    brand: String(input?.brand ?? ""),
    category: String(input?.category ?? ""),
    url: String(input?.url ?? ""),
    price: Number(input?.price),
    photo: String(input?.photo ?? ""),
    what: String(input?.what ?? ""),
    note: String(input?.note ?? ""),
    sinceYear: input?.sinceYear === null || input?.sinceYear === undefined || input?.sinceYear === ("" as unknown) ? null : Number(input.sinceYear),
    original: Boolean(input?.original),
    officialClaim: Boolean(input?.officialClaim),
    displayName: String(input?.displayName ?? ""),
  };
}

async function writeProduct(
  sql: Sql,
  personId: string,
  input: IntroduceInput,
  exceptId = "",
): Promise<ActionResult> {
  if (!input.original) return { ok: false, error: "Confirm this is an original." };
  if (!input.officialClaim) return { ok: false, error: "Confirm the link is the official brand or store." };
  const name = cleanName(input.name);
  if (!name.ok) return { ok: false, error: name.error };
  if (!isCategory(input.category)) return { ok: false, error: "Pick a category." };
  const parsed = canonicalUrl(input.url);
  if (!parsed.ok) return { ok: false, error: parsed.reason };
  const price = cleanPrice(input.price);
  if (!price.ok) return { ok: false, error: price.error };
  const what = cleanWhat(input.what);
  if (!what.ok) return { ok: false, error: what.error };
  const note = cleanNote(input.note);
  if (!note.ok) return { ok: false, error: note.error };
  const year = cleanYear(input.sinceYear);
  if (!year.ok) return { ok: false, error: year.error };
  const photo = cleanPhoto(input.photo, !exceptId);
  if (!photo.ok) return { ok: false, error: photo.error };
  const hosts = await allowHosts(sql);
  const official = isAllowlisted(parsed.host, hosts);
  const brandId = await ensureBrand(sql, input.brand, official ? parsed.host : null);
  if (!brandId) return { ok: false, error: "Add a brand name." };
  const dup = await findDuplicate(sql, normName(name.value), brandId, parsed.url, exceptId);
  if (dup) {
    return {
      ok: false,
      error: dup.status === "live" ? "This is already here." : "This is already submitted.",
      duplicateSlug: dup.slug,
      duplicateLive: dup.status === "live",
    };
  }
  const status: ProductStatus = official ? "live" : "in_review";
  const noted = today();
  if (exceptId) {
    const current = await sql<{ photo: string }>`select photo from products where id = ${exceptId} limit 1`;
    const nextPhoto = photo.value || current[0]?.photo || "";
    if (!nextPhoto) return { ok: false, error: "Add one photo." };
    await sql`
      update products set
        name = ${name.value},
        name_norm = ${normName(name.value)},
        brand_id = ${brandId},
        category = ${input.category},
        photo = ${nextPhoto},
        what_it_is = ${what.value},
        price = ${price.value},
        price_noted_on = ${noted},
        official_url = ${parsed.url},
        official_host = ${parsed.host},
        canonical_url = ${parsed.url},
        status = ${status},
        ever_live = (ever_live or ${status === "live"}),
        reject_reason = null
      where id = ${exceptId}
    `;
    await sql`
      update uses set note = ${note.value}, since_year = ${year.value}, status = ${status}
      where person_id = ${personId} and product_id = ${exceptId}
    `;
    const slugRow = await sql<{ slug: string }>`select slug from products where id = ${exceptId} limit 1`;
    return { ok: true, slug: slugRow[0]?.slug ?? exceptId, status };
  }
  if (!photo.value) return { ok: false, error: "Add one photo." };
  const slug = await uniqueSlug(sql, slugify(name.value));
  await sql`
    insert into products (
      id, slug, name, name_norm, brand_id, category, photo, what_it_is, price, price_noted_on,
      official_url, official_host, canonical_url, status, introduced_by, featured, ever_live, reject_reason
    ) values (
      ${slug}, ${slug}, ${name.value}, ${normName(name.value)}, ${brandId}, ${input.category},
      ${photo.value}, ${what.value}, ${price.value}, ${noted},
      ${parsed.url}, ${parsed.host}, ${parsed.url}, ${status}, ${personId}, false, ${status === "live"}, null
    )
  `;
  await sql`
    insert into uses (id, person_id, product_id, note, since_year, status)
    values (${crypto.randomUUID()}, ${personId}, ${slug}, ${note.value}, ${year.value}, ${status})
  `;
  return { ok: true, slug, status };
}

export const holdExisting = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { slug: string; note: string; sinceYear: number | null; original: boolean; name: string }) => ({
    slug: String(input?.slug ?? ""),
    note: String(input?.note ?? ""),
    sinceYear: input?.sinceYear === null || input?.sinceYear === undefined || input?.sinceYear === ("" as unknown) ? null : Number(input.sinceYear),
    original: Boolean(input?.original),
    name: String(input?.name ?? ""),
  }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    if (!data.original) return { ok: false, error: "Confirm this is an original." };
    const note = cleanNote(data.note);
    if (!note.ok) return { ok: false, error: note.error };
    const year = cleanYear(data.sinceYear);
    if (!year.ok) return { ok: false, error: year.error };
    const sql = await db();
    const person = await ensurePerson(sql, context.userId, data.name);
    const products = await sql<{ id: string; status: ProductStatus }>`
      select id, status from products where slug = ${data.slug} limit 1
    `;
    const product = products[0];
    if (!product || product.status !== "live") return { ok: false, error: "That product is not live." };
    const existing = await sql<{ id: string }>`
      select id from uses where person_id = ${person.id} and product_id = ${product.id} limit 1
    `;
    if (existing[0]) return { ok: true, slug: data.slug, status: "live" };
    try {
      await sql`
        insert into uses (id, person_id, product_id, note, since_year, status)
        values (${crypto.randomUUID()}, ${person.id}, ${product.id}, ${note.value}, ${year.value}, 'live')
      `;
    } catch (error) {
      if (!isUnique(error)) throw error;
    }
    return { ok: true, slug: data.slug, status: "live" };
  });

export const introduceProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: IntroduceInput) => readIntroduce(input))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const sql = await db();
    const person = await ensurePerson(sql, context.userId, data.displayName);
    try {
      return await writeProduct(sql, person.id, data);
    } catch (error) {
      if (isUnique(error)) return { ok: false, error: "This is already submitted." };
      throw error;
    }
  });

export const getKit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<{
      use_id: string;
      slug: string;
      name: string;
      photo: string;
      brand_name: string;
      category: string;
      price: number;
      official_url: string;
      official_host: string;
      what_it_is: string;
      status: ProductStatus;
      note: string;
      since_year: number | null;
      reject_reason: string | null;
      introduced: boolean | string | number;
    }>`
      select u.id as use_id, p.slug, p.name, p.photo, b.name as brand_name, p.category, p.price,
        p.official_url, p.official_host, p.what_it_is, p.status, u.note, u.since_year, p.reject_reason,
        (p.introduced_by = ${context.userId}) as introduced
      from uses u
      join products p on p.id = u.product_id
      join brands b on b.id = p.brand_id
      where u.person_id = ${context.userId}
      order by u.created_at desc
    `;
    const items: KitItem[] = rows.map((row) => ({
      useId: row.use_id,
      slug: row.slug,
      name: row.name,
      photo: row.photo,
      brandName: row.brand_name,
      category: row.category,
      price: num(row.price),
      officialUrl: row.official_url,
      officialHost: row.official_host,
      what: row.what_it_is,
      status: row.status,
      note: row.note,
      sinceYear: row.since_year,
      rejectReason: row.reject_reason,
      introducedByMe: flag(row.introduced),
    }));
    return { items };
  });

export const updateUse = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { useId: string; note: string; sinceYear: number | null }) => ({
    useId: String(input?.useId ?? ""),
    note: String(input?.note ?? ""),
    sinceYear: input?.sinceYear === null || input?.sinceYear === undefined || input?.sinceYear === ("" as unknown) ? null : Number(input.sinceYear),
  }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const note = cleanNote(data.note);
    if (!note.ok) return { ok: false, error: note.error };
    const year = cleanYear(data.sinceYear);
    if (!year.ok) return { ok: false, error: year.error };
    const sql = await db();
    const rows = await sql<{ slug: string; status: ProductStatus }>`
      select p.slug, p.status
      from uses u join products p on p.id = u.product_id
      where u.id = ${data.useId} and u.person_id = ${context.userId}
      limit 1
    `;
    if (!rows[0]) return { ok: false, error: "Not in your kit." };
    await sql`update uses set note = ${note.value}, since_year = ${year.value} where id = ${data.useId}`;
    return { ok: true, slug: rows[0].slug, status: rows[0].status };
  });

export const removeUse = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((useId: string) => String(useId ?? ""))
  .handler(async ({ data: useId, context }) => {
    const sql = await db();
    const rows = await sql<{ product_id: string; introduced_by: string; ever_live: boolean | string }>`
      select u.product_id, p.introduced_by, p.ever_live
      from uses u join products p on p.id = u.product_id
      where u.id = ${useId} and u.person_id = ${context.userId}
      limit 1
    `;
    const row = rows[0];
    if (!row) return { ok: false as const, error: "Not in your kit." };
    await sql`delete from uses where id = ${useId} and person_id = ${context.userId}`;
    if (!flag(row.ever_live) && row.introduced_by === context.userId) {
      const left = await sql`select id from uses where product_id = ${row.product_id} limit 1`;
      if (!left.length) {
        await sql`delete from list_products where product_id = ${row.product_id}`;
        await sql`delete from products where id = ${row.product_id}`;
      }
    }
    return { ok: true as const };
  });

export const updateOwnProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: IntroduceInput & { slug: string }) => ({ ...readIntroduce(input), slug: String(input?.slug ?? "") }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const sql = await db();
    const rows = await sql<{ id: string; status: ProductStatus; introduced_by: string }>`
      select id, status, introduced_by from products where slug = ${data.slug} limit 1
    `;
    const product = rows[0];
    if (!product || product.introduced_by !== context.userId) return { ok: false, error: "You can only edit your own submission." };
    if (product.status === "live") return { ok: false, error: "Live products are edited by an editor." };
    try {
      return await writeProduct(sql, context.userId, data, product.id);
    } catch (error) {
      if (isUnique(error)) return { ok: false, error: "This is already submitted." };
      throw error;
    }
  });

export const relationTo = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((slug: string) => String(slug ?? ""))
  .handler(async ({ data: slug, context }) => {
    const sql = await db();
    const rows = await sql`
      select u.id from uses u
      join products p on p.id = u.product_id
      where u.person_id = ${context.userId} and p.slug = ${slug}
      limit 1
    `;
    return { holds: rows.length > 0 };
  });

export const getReview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    if (!(await requireEditor(sql, context.userId))) {
      return { forbidden: true, queue: [] as ReviewItem[], live: [] as LiveFeature[] };
    }
    const queue = await sql<{
      slug: string;
      name: string;
      photo: string;
      brand_name: string;
      official_url: string;
      official_host: string;
      what_it_is: string;
      price: number;
      submitter_name: string;
      submitter_handle: string;
      price_noted_on: string;
    }>`
      select p.slug, p.name, p.photo, b.name as brand_name, p.official_url, p.official_host,
        p.what_it_is, p.price, pe.name as submitter_name, pe.handle as submitter_handle, p.price_noted_on
      from products p
      join brands b on b.id = p.brand_id
      join people pe on pe.id = p.introduced_by
      where p.status = 'in_review'
      order by p.created_at asc
    `;
    const live = await sql<{ slug: string; name: string; featured: boolean | string }>`
      select slug, name, featured from products where status = 'live' order by name asc
    `;
    return {
      forbidden: false,
      queue: queue.map((row): ReviewItem => ({
        slug: row.slug,
        name: row.name,
        photo: row.photo,
        brandName: row.brand_name,
        officialUrl: row.official_url,
        officialHost: row.official_host,
        what: row.what_it_is,
        price: num(row.price),
        submitterName: row.submitter_name,
        submitterHandle: row.submitter_handle,
        notedOn: day(row.price_noted_on),
      })),
      live: live.map((row): LiveFeature => ({ slug: row.slug, name: row.name, featured: flag(row.featured) })),
    };
  });

export const getAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AdminData> => {
    const empty: AdminData = { forbidden: true, people: 0, queue: [], returned: [], live: [], allowlist: [] };
    const sql = await db();
    if (!(await requireEditor(sql, context.userId))) return empty;
    const [queue, returned, live, allowlist, people] = await Promise.all([
      sql<{
        slug: string;
        name: string;
        photo: string;
        brand_name: string;
        official_url: string;
        official_host: string;
        what_it_is: string;
        price: number;
        submitter_name: string;
        submitter_handle: string;
        price_noted_on: string;
      }>`
        select p.slug, p.name, p.photo, b.name as brand_name, p.official_url, p.official_host,
          p.what_it_is, p.price, pe.name as submitter_name, pe.handle as submitter_handle, p.price_noted_on
        from products p
        join brands b on b.id = p.brand_id
        join people pe on pe.id = p.introduced_by
        where p.status = 'in_review'
        order by p.created_at asc
      `,
      sql<{
        slug: string;
        name: string;
        photo: string;
        brand_name: string;
        official_url: string;
        official_host: string;
        what_it_is: string;
        price: number;
        submitter_name: string;
        submitter_handle: string;
        price_noted_on: string;
        reject_reason: string | null;
      }>`
        select p.slug, p.name, p.photo, b.name as brand_name, p.official_url, p.official_host,
          p.what_it_is, p.price, pe.name as submitter_name, pe.handle as submitter_handle,
          p.price_noted_on, p.reject_reason
        from products p
        join brands b on b.id = p.brand_id
        join people pe on pe.id = p.introduced_by
        where p.status = 'needs_edit'
        order by p.created_at asc
      `,
      sql<{
        slug: string;
        name: string;
        photo: string;
        brand_name: string;
        category: string;
        featured: boolean | string | number;
      }>`
        select p.slug, p.name, p.photo, b.name as brand_name, p.category, p.featured
        from products p
        join brands b on b.id = p.brand_id
        where p.status = 'live'
        order by p.featured desc, p.name asc
      `,
      sql<{ host: string; added_at: string | Date }>`
        select host, added_at from allowlist order by host asc
      `,
      sql<{ n: number }>`select count(*) as n from people`,
    ]);
    const toReview = (row: (typeof queue)[number]): ReviewItem => ({
      slug: row.slug,
      name: row.name,
      photo: row.photo,
      brandName: row.brand_name,
      officialUrl: row.official_url,
      officialHost: row.official_host,
      what: row.what_it_is,
      price: num(row.price),
      submitterName: row.submitter_name,
      submitterHandle: row.submitter_handle,
      notedOn: day(row.price_noted_on),
    });
    return {
      forbidden: false,
      people: num(people[0]?.n),
      queue: queue.map(toReview),
      returned: returned.map(
        (row): AdminEditItem => ({ ...toReview(row), rejectReason: row.reject_reason }),
      ),
      live: live.map(
        (row): AdminLiveItem => ({
          slug: row.slug,
          name: row.name,
          photo: row.photo,
          brandName: row.brand_name,
          category: row.category,
          featured: flag(row.featured),
        }),
      ),
      allowlist: allowlist.map((row): AdminHost => ({ host: row.host, addedAt: day(row.added_at) })),
    };
  });

export const approveProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { slug: string; addHost?: boolean }) => ({
    slug: String(input?.slug ?? ""),
    addHost: Boolean(input?.addHost),
  }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const sql = await db();
    if (!(await requireEditor(sql, context.userId))) return { ok: false, error: "Editors only." };
    const rows = await sql<{ id: string; official_host: string; status: ProductStatus }>`
      select id, official_host, status from products where slug = ${data.slug} limit 1
    `;
    const product = rows[0];
    if (!product || product.status !== "in_review") return { ok: false, error: "That submission is not in review." };
    if (data.addHost) {
      await sql`
        insert into allowlist (host, added_by) values (${product.official_host}, ${context.userId})
        on conflict (host) do nothing
      `;
    }
    await sql`update products set status = 'live', ever_live = true, reject_reason = null where id = ${product.id}`;
    await sql`update uses set status = 'live' where product_id = ${product.id}`;
    return { ok: true, slug: data.slug, status: "live" };
  });

export const rejectProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { slug: string; reason: string }) => ({
    slug: String(input?.slug ?? ""),
    reason: String(input?.reason ?? ""),
  }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const reason = (REJECT_REASONS as readonly string[]).includes(data.reason) ? (data.reason as RejectReason) : null;
    if (!reason) return { ok: false, error: "Pick a reason." };
    const sql = await db();
    if (!(await requireEditor(sql, context.userId))) return { ok: false, error: "Editors only." };
    const rows = await sql<{ id: string; status: ProductStatus }>`
      select id, status from products where slug = ${data.slug} limit 1
    `;
    if (!rows[0] || rows[0].status !== "in_review") return { ok: false, error: "That submission is not in review." };
    await sql`update products set status = 'needs_edit', reject_reason = ${reason} where id = ${rows[0].id}`;
    await sql`update uses set status = 'needs_edit' where product_id = ${rows[0].id}`;
    return { ok: true, slug: data.slug, status: "needs_edit" };
  });

export const setFeatured = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { slug: string; featured: boolean }) => ({
    slug: String(input?.slug ?? ""),
    featured: Boolean(input?.featured),
  }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const sql = await db();
    if (!(await requireEditor(sql, context.userId))) return { ok: false, error: "Editors only." };
    const rows = await sql<{ id: string; status: ProductStatus }>`
      select id, status from products where slug = ${data.slug} limit 1
    `;
    if (!rows[0] || rows[0].status !== "live") return { ok: false, error: "Only live products can be featured." };
    await sql`update products set featured = ${data.featured} where id = ${rows[0].id}`;
    return { ok: true, slug: data.slug, status: "live" };
  });

export const editorUpdateProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { slug: string; name: string; brand: string; category: string; url: string; price: number; what: string; photo?: string }) => ({
    slug: String(input?.slug ?? ""),
    name: String(input?.name ?? ""),
    brand: String(input?.brand ?? ""),
    category: String(input?.category ?? ""),
    url: String(input?.url ?? ""),
    price: Number(input?.price),
    what: String(input?.what ?? ""),
    photo: String(input?.photo ?? ""),
  }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const sql = await db();
    if (!(await requireEditor(sql, context.userId))) return { ok: false, error: "Editors only." };
    const name = cleanName(data.name);
    if (!name.ok) return { ok: false, error: name.error };
    if (!isCategory(data.category)) return { ok: false, error: "Pick a category." };
    const parsed = canonicalUrl(data.url);
    if (!parsed.ok) return { ok: false, error: parsed.reason };
    const price = cleanPrice(data.price);
    if (!price.ok) return { ok: false, error: price.error };
    const what = cleanWhat(data.what);
    if (!what.ok) return { ok: false, error: what.error };
    const photo = cleanPhoto(data.photo, false);
    if (!photo.ok) return { ok: false, error: photo.error };
    const rows = await sql<{ id: string; status: ProductStatus; photo: string }>`
      select id, status, photo from products where slug = ${data.slug} limit 1
    `;
    const product = rows[0];
    if (!product || product.status !== "live") return { ok: false, error: "Only live products can be edited here." };
    const hosts = await allowHosts(sql);
    const brandId = await ensureBrand(sql, data.brand, isAllowlisted(parsed.host, hosts) ? parsed.host : null);
    if (!brandId) return { ok: false, error: "Add a brand name." };
    const dup = await findDuplicate(sql, normName(name.value), brandId, parsed.url, product.id);
    if (dup) return { ok: false, error: "This is already here.", duplicateSlug: dup.slug, duplicateLive: dup.status === "live" };
    await sql`
      update products set
        name = ${name.value},
        name_norm = ${normName(name.value)},
        brand_id = ${brandId},
        category = ${data.category},
        photo = ${photo.value || product.photo},
        what_it_is = ${what.value},
        price = ${price.value},
        price_noted_on = ${today()},
        official_url = ${parsed.url},
        official_host = ${parsed.host},
        canonical_url = ${parsed.url}
      where id = ${product.id}
    `;
    return { ok: true, slug: data.slug, status: product.status };
  });
