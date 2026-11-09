create table if not exists people (
  id text primary key,
  handle text not null unique,
  name text not null,
  bio text not null default '' check (char_length(bio) <= 80),
  city text not null default '',
  avatar text,
  role text not null default 'member' check (role in ('member', 'editor')),
  demo_seeded boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists brands (
  id text primary key,
  name text not null,
  slug text not null unique,
  official_domain text
);

create table if not exists products (
  id text primary key,
  slug text not null unique,
  name text not null check (char_length(name) between 2 and 80),
  name_norm text not null,
  brand_id text not null references brands (id),
  category text not null check (category in ('Tech', 'Audio', 'Workspace', 'Carry', 'Home')),
  photo text not null,
  what_it_is text not null check (char_length(what_it_is) between 1 and 140),
  price integer not null check (price > 0),
  price_noted_on date not null,
  official_url text not null,
  official_host text not null,
  canonical_url text not null unique,
  status text not null check (status in ('in_review', 'live', 'needs_edit')),
  introduced_by text not null references people (id),
  featured boolean not null default false,
  ever_live boolean not null default false,
  reject_reason text,
  created_at timestamptz not null default now()
);

create table if not exists uses (
  id text primary key,
  person_id text not null references people (id),
  product_id text not null references products (id) on delete cascade,
  note text not null check (char_length(note) between 40 and 280),
  since_year integer,
  status text not null default 'live' check (status in ('live', 'in_review', 'needs_edit')),
  created_at timestamptz not null default now(),
  unique (person_id, product_id)
);

create table if not exists lists (
  id text primary key,
  slug text not null unique,
  title text not null,
  sentence text not null,
  author_id text not null references people (id)
);

create table if not exists list_products (
  list_id text not null references lists (id) on delete cascade,
  product_id text not null references products (id) on delete cascade,
  position integer not null,
  primary key (list_id, product_id)
);

create table if not exists allowlist (
  host text primary key,
  added_at timestamptz not null default now(),
  added_by text
);

create index if not exists products_status_idx on products (status);
create index if not exists products_name_brand_idx on products (name_norm, brand_id);
create index if not exists uses_person_idx on uses (person_id);
create index if not exists uses_product_idx on uses (product_id);

insert into people (id, handle, name, bio, city, role, demo_seeded) values
  ('seed-ilham', 'ilham', 'Ilham', 'designer', 'Solo', 'member', true),
  ('seed-sari', 'sari', 'Sari Wibowo', 'listener', 'Bandung', 'member', true),
  ('seed-reza', 'reza', 'Reza Putra', 'carrying less', 'Jakarta', 'member', true),
  ('seed-maya', 'maya', 'Maya Tan', 'studio', 'Yogyakarta', 'member', true)
on conflict (id) do nothing;

insert into brands (id, name, slug, official_domain) values
  ('apple', 'Apple', 'apple', 'apple.com'),
  ('keychron', 'Keychron', 'keychron', 'keychron.com'),
  ('native-union', 'Native Union', 'native-union', 'nativeunion.com'),
  ('sony', 'Sony', 'sony', 'sony.com'),
  ('bose', 'Bose', 'bose', 'bose.com'),
  ('shure', 'Shure', 'shure', 'shure.com'),
  ('peak-design', 'Peak Design', 'peak-design', 'peakdesign.com'),
  ('anker', 'Anker', 'anker', 'anker.com'),
  ('logitech', 'Logitech', 'logitech', 'logitech.com'),
  ('nuphy', 'NuPhy', 'nuphy', 'nuphy.com'),
  ('dyson', 'Dyson', 'dyson', 'dyson.com')
on conflict (id) do nothing;

insert into allowlist (host) values
  ('apple.com'), ('samsung.com'), ('sony.com'), ('bose.com'), ('nintendo.com'),
  ('logitech.com'), ('keychron.com'), ('nuphy.com'), ('nativeunion.com'), ('dyson.com'),
  ('dell.com'), ('asus.com'), ('lenovo.com'), ('google.com'), ('store.google.com'),
  ('nothing.tech'), ('anker.com'), ('belkin.com'), ('sennheiser.com'), ('shure.com'),
  ('audio-technica.com'), ('fujifilm.com'), ('canon.com'), ('nikon.com'),
  ('peakdesign.com'), ('dji.com')
on conflict (host) do nothing;

insert into products (
  id, slug, name, name_norm, brand_id, category, photo, what_it_is, price, price_noted_on,
  official_url, official_host, canonical_url, status, introduced_by, featured, ever_live, created_at
) values
  ('macbook-pro-14', 'macbook-pro-14', 'MacBook Pro 14"', 'macbook pro 14', 'apple', 'Tech', '/photos/macbook-pro-14.jpg',
    'A 14-inch laptop for daily design work.', 29999000, '2026-10-12',
    'https://www.apple.com/macbook-pro/', 'apple.com', 'https://apple.com/macbook-pro',
    'live', 'seed-ilham', true, true, '2026-10-12'),
  ('airpods-pro-2', 'airpods-pro-2', 'AirPods Pro 2', 'airpods pro 2', 'apple', 'Audio', '/photos/airpods-pro-2.jpg',
    'In-ear headphones with a seal that holds on a walk.', 3999000, '2026-10-08',
    'https://www.apple.com/airpods-pro/', 'apple.com', 'https://apple.com/airpods-pro',
    'live', 'seed-ilham', false, true, '2026-10-08'),
  ('keychron-q1', 'keychron-q1', 'Keychron Q1 HE', 'keychron q1 he', 'keychron', 'Workspace', '/photos/keychron-q1.jpg',
    'A metal keyboard that stays on the desk.', 3299000, '2026-09-28',
    'https://www.keychron.com/products/keychron-q1-he', 'keychron.com', 'https://keychron.com/products/keychron-q1-he',
    'live', 'seed-ilham', false, true, '2026-09-28'),
  ('rise-dock', 'rise-dock', 'Rise Dock', 'rise dock', 'native-union', 'Workspace', '/photos/rise-dock.jpg',
    'A charging stand that keeps a phone off the laptop.', 1499000, '2026-10-02',
    'https://www.nativeunion.com/products/rise', 'nativeunion.com', 'https://nativeunion.com/products/rise',
    'live', 'seed-ilham', false, true, '2026-10-02'),
  ('wh-1000xm5', 'wh-1000xm5', 'WH-1000XM5', 'wh 1000xm5', 'sony', 'Audio', '/photos/wh-1000xm5.jpg',
    'Over-ear headphones for long listening.', 5499000, '2026-08-19',
    'https://www.sony.com/headphones', 'sony.com', 'https://sony.com/headphones',
    'live', 'seed-sari', false, true, '2026-08-19'),
  ('qc-ultra', 'qc-ultra', 'QuietComfort Ultra', 'quietcomfort ultra', 'bose', 'Audio', '/photos/qc-ultra.jpg',
    'Headphones built for a noisy train.', 6999000, '2026-07-14',
    'https://www.bose.com/headphones', 'bose.com', 'https://bose.com/headphones',
    'live', 'seed-sari', false, true, '2026-07-14'),
  ('mv7', 'mv7', 'MV7+', 'mv7', 'shure', 'Audio', '/photos/mv7.jpg',
    'A microphone for calls that should sound like a room.', 4499000, '2026-06-02',
    'https://www.shure.com/mv7', 'shure.com', 'https://shure.com/mv7',
    'live', 'seed-sari', false, true, '2026-06-02'),
  ('everyday-backpack', 'everyday-backpack', 'Everyday Backpack 20L', 'everyday backpack 20l', 'peak-design', 'Carry', '/photos/everyday-backpack.jpg',
    'A backpack that keeps a camera and a laptop apart.', 4799000, '2026-09-01',
    'https://www.peakdesign.com/everyday-backpack', 'peakdesign.com', 'https://peakdesign.com/everyday-backpack',
    'live', 'seed-reza', true, true, '2026-09-01'),
  ('anker-737', 'anker-737', '737 Power Bank', '737 power bank', 'anker', 'Carry', '/photos/anker-737.jpg',
    'A battery that covers a day away from a desk.', 1899000, '2026-05-20',
    'https://www.anker.com/737', 'anker.com', 'https://anker.com/737',
    'live', 'seed-reza', false, true, '2026-05-20'),
  ('mx-master-3s', 'mx-master-3s', 'MX Master 3S', 'mx master 3s', 'logitech', 'Workspace', '/photos/mx-master-3s.jpg',
    'A mouse shaped for a long stretch of editing.', 1699000, '2026-04-11',
    'https://www.logitech.com/mx-master-3s', 'logitech.com', 'https://logitech.com/mx-master-3s',
    'live', 'seed-maya', false, true, '2026-04-11'),
  ('nuphy-air75', 'nuphy-air75', 'Air75 V2', 'air75 v2', 'nuphy', 'Workspace', '/photos/nuphy-air75.jpg',
    'A low keyboard for a small table.', 2199000, '2026-03-30',
    'https://nuphy.com/air75-v2', 'nuphy.com', 'https://nuphy.com/air75-v2',
    'live', 'seed-maya', false, true, '2026-03-30'),
  ('solarcycle', 'solarcycle', 'Solarcycle Morph', 'solarcycle morph', 'dyson', 'Home', '/photos/solarcycle.jpg',
    'A lamp that tracks the day and leaves the desk clear.', 9999000, '2026-02-18',
    'https://www.dyson.com/lighting', 'dyson.com', 'https://dyson.com/lighting',
    'live', 'seed-maya', true, true, '2026-02-18')
on conflict (id) do nothing;

insert into uses (id, person_id, product_id, note, since_year, status) values
  ('use-ilham-mac', 'seed-ilham', 'macbook-pro-14', 'The machine on this desk. The fans stay quiet, and the screen is the reason a second display never earned a place here.', 2023, 'live'),
  ('use-sari-mac', 'seed-sari', 'macbook-pro-14', 'Same laptop, mostly for writing on trains between Bandung and Jakarta. The battery is the whole argument.', 2024, 'live'),
  ('use-reza-mac', 'seed-reza', 'macbook-pro-14', 'I use it when a job needs a real screen. It stays home more often than the bag does.', 2025, 'live'),
  ('use-ilham-pods', 'seed-ilham', 'airpods-pro-2', 'For walks around Solo and for calls that should not spill into the room. They live in the same tray as the keys.', 2024, 'live'),
  ('use-maya-pods', 'seed-maya', 'airpods-pro-2', 'I borrow them for editing voice notes when the studio monitors are too much. Small, and they stay charged.', 2025, 'live'),
  ('use-ilham-key', 'seed-ilham', 'keychron-q1', 'It does not leave the desk. The weight is the point: a keyboard that asks you to sit down and work.', 2024, 'live'),
  ('use-ilham-rise', 'seed-ilham', 'rise-dock', 'The phone stands here while the laptop is open, instead of face-down on the notebook. One cable, no pile.', 2025, 'live'),
  ('use-sari-sony', 'seed-sari', 'wh-1000xm5', 'These are the headphones I actually finish records in. The room can be noisy. The mix still holds.', 2022, 'live'),
  ('use-reza-sony', 'seed-reza', 'wh-1000xm5', 'I held these for a month of travel. They fold into the bag and they are the pair I reach for on a flight.', 2025, 'live'),
  ('use-sari-bose', 'seed-sari', 'qc-ultra', 'For the train, not the studio. They take the edge off a carriage without making the city disappear.', 2024, 'live'),
  ('use-sari-mv7', 'seed-sari', 'mv7', 'Calls and the occasional voice note. It sounds like a room, which is all I wanted from a desk microphone.', 2023, 'live'),
  ('use-reza-bag', 'seed-reza', 'everyday-backpack', 'Twenty litres, and the camera does not knock the laptop. This is the bag that replaced two smaller ones.', 2024, 'live'),
  ('use-maya-bag', 'seed-maya', 'everyday-backpack', 'I use it on days the studio moves. Dividers keep a lens off the keyboard. That is enough.', 2025, 'live'),
  ('use-reza-anker', 'seed-reza', 'anker-737', 'A day away from a desk, including a train and a cafe. It covers the phone and still has something left.', 2023, 'live'),
  ('use-maya-mouse', 'seed-maya', 'mx-master-3s', 'The mouse for a long stretch of editing. It stays to the right of the keyboard and does not ask to be replaced.', 2022, 'live'),
  ('use-maya-nuphy', 'seed-maya', 'nuphy-air75', 'A low keyboard for a small table. It is the one I take when the studio keyboard would be absurd.', 2024, 'live'),
  ('use-maya-lamp', 'seed-maya', 'solarcycle', 'The lamp tracks the day and leaves the rest of the desk alone. I stopped adding other lights.', 2021, 'live')
on conflict (id) do nothing;

insert into lists (id, slug, title, sentence, author_id) values
  ('desk', 'desk', 'Desk', 'Four objects that stay on one desk in Solo, and nothing that travels.', 'seed-ilham')
on conflict (id) do nothing;

insert into list_products (list_id, product_id, position) values
  ('desk', 'macbook-pro-14', 0),
  ('desk', 'airpods-pro-2', 1),
  ('desk', 'keychron-q1', 2),
  ('desk', 'rise-dock', 3)
on conflict (list_id, product_id) do nothing;
