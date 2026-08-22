-- Schéma de la base — à exécuter dans Supabase : SQL Editor > New query > Run
-- (une seule fois)

create extension if not exists "pgcrypto";

-- ── Produit (un seul produit, une seule ligne) ─────────────────────────────
create table if not exists public.product (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mon Produit',
  description text not null default '',
  price numeric not null default 0,
  old_price numeric,
  delivery_home numeric not null default 500,
  delivery_desk numeric not null default 350,
  images jsonb not null default '[]'::jsonb,
  features jsonb not null default '[]'::jsonb,
  colors jsonb not null default '[]'::jsonb,   -- [{ "name": "Noir", "hex": "#111111" }]
  sizes jsonb not null default '[]'::jsonb,    -- ["S", "M", "L"]
  -- Offres groupées : « 2 pièces à 4 000 DA ». Chaque pack porte son prix total
  -- (pas unitaire) et son traitement visuel sur la landing :
  -- [{ "id": uuid, "label": "Pack 2 pièces", "quantity": 2,
  --    "price": 4000, "old_price": 5000|null, "badge": "الأكثر طلبا"|null,
  --    "highlight": "none"|"badge"|"border" }]
  -- Vide = la landing garde son sélecteur de quantité et son prix × quantité.
  packs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── Commandes ──────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text not null,
  phone text not null,
  wilaya text not null,
  commune text not null,
  address text,
  delivery_type text not null default 'domicile' check (delivery_type in ('domicile','stopdesk')),
  stopdesk_id int,
  stopdesk_name text,
  -- Pack retenu, figé à la commande : renommer un pack dans l'admin ne doit
  -- pas réécrire l'historique. Null = commande sans pack.
  pack_label text,
  -- Variante de chaque pièce : [{ "color": "Noir", "size": "M" }, ...]
  -- Un pack de 2 pièces produit 2 entrées.
  items jsonb not null default '[]'::jsonb,
  -- Résumé des valeurs distinctes de `items` ("Noir, Blanc") : garde les
  -- anciennes lignes et les cellules compactes lisibles sans cas particulier.
  color text,
  size text,
  quantity int not null default 1 check (quantity > 0),
  total numeric not null default 0,
  status text not null default 'en_attente'
    check (status in ('en_attente','confirmee','annulee')),
  yalidine_tracking text,
  yalidine_status text,
  yalidine_label text,
  notes text
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

-- ── Paramètres (une seule ligne) ───────────────────────────────────────────
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  store_name text not null default 'Ma Boutique',
  logo_url text,
  primary_color text not null default '#4f46e5',
  from_wilaya text not null default '16 - Alger',
  pixel_id text,   -- Meta Pixel ID (Facebook), optionnel
  fb_domain_verification text,   -- Meta Domain Verification (balise meta), optionnel
  -- Livraison offerte : 'none' (le client paie), 'stopdesk' (bureau offert,
  -- domicile payant) ou 'all' (tout offert, livraison toujours à domicile).
  -- Yalidine prélève ses frais dans tous les cas : c'est la marge qui absorbe.
  free_delivery_mode text not null default 'none'
    check (free_delivery_mode in ('none','all','stopdesk')),
  updated_at timestamptz not null default now()
);

-- ── Tentatives de connexion admin (anti brute force) ───────────────────────
create table if not exists public.login_attempts (
  ip text primary key,
  failures int not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  lockouts int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists login_attempts_updated_at_idx
  on public.login_attempts (updated_at);

-- Lignes initiales
insert into public.product (name) select 'Mon Produit'
  where not exists (select 1 from public.product);
insert into public.settings (store_name) select 'Ma Boutique'
  where not exists (select 1 from public.settings);

-- ── Sécurité : RLS activé, aucun accès public ──────────────────────────────
-- (le site utilise la clé service_role côté serveur uniquement)
alter table public.product enable row level security;
alter table public.orders enable row level security;
alter table public.settings enable row level security;
alter table public.login_attempts enable row level security;

-- ── Storage : bucket public pour les images produit et le logo ─────────────
insert into storage.buckets (id, name, public)
  values ('images', 'images', true)
  on conflict (id) do nothing;
