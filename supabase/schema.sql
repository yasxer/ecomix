-- Schéma de la base — à exécuter dans Supabase : SQL Editor > New query > Run
-- (une seule fois)

create extension if not exists "pgcrypto";

-- ── Produits ───────────────────────────────────────────────────────────────
-- Une ligne = une boutique : un produit, son domaine, sa vitrine et sa
-- landing page. Les colonnes de vitrine (nom, logo, couleur, pixel, blocs)
-- vivaient dans `settings` avant la migration 015.
create table if not exists public.product (
  id uuid primary key default gen_random_uuid(),
  -- Clé lisible : aperçu sur /p/mon-produit tant que le domaine n'est pas
  -- branché, et repli si le DNS tombe.
  slug text not null
    check (slug ~ '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$'),
  -- Domaine dédié, en minuscules et sans "www.". Null = accessible seulement
  -- par son slug.
  domain text,
  -- Un produit inactif n'est plus servi ni commandable, sans être supprimé.
  active boolean not null default true,
  -- Préparation du multi-comptes : null = le propriétaire de la plateforme.
  -- Le jour du passage en SaaS, cette colonne portera l'id du vendeur, les
  -- identifiants Yalidine/Telegram passeront dans une table `owners`, et les
  -- policies RLS s'appuieront dessus.
  owner_id uuid,
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

  -- ── Vitrine : ce que voit le client sur ce domaine ──
  store_name text not null default 'Ma Boutique',
  logo_url text,
  primary_color text not null default '#4f46e5',
  pixel_id text,   -- Meta Pixel ID (Facebook), optionnel — un par domaine
  fb_domain_verification text,   -- Meta Domain Verification (balise meta), optionnel
  -- Livraison offerte : 'none' (le client paie), 'stopdesk' (bureau offert,
  -- domicile payant) ou 'all' (tout offert, livraison toujours à domicile).
  -- Yalidine prélève ses frais dans tous les cas : c'est la marge qui absorbe.
  free_delivery_mode text not null default 'none'
    check (free_delivery_mode in ('none','all','stopdesk')),
  -- Mise en page de la landing : 'simple' (ordre fixe) ou 'custom' (blocs
  -- ordonnés composés depuis /admin/produits/<id>/landing).
  landing_mode text not null default 'simple'
    check (landing_mode in ('simple','custom')),
  -- Blocs du mode custom, dans l'ordre d'affichage :
  --   { "id": uuid, "type": "hero" }                titre + prix + badges
  --   { "id": uuid, "type": "gallery" }             galerie des images produit
  --   { "id": uuid, "type": "description" }         description + points forts
  --   { "id": uuid, "type": "form" }                offres groupées + formulaire
  --   { "id": uuid, "type": "image", "url": "...",  image pleine largeur
  --     "width": 1200, "height": 1600 }             (dimensions : évite le CLS)
  --   { "id": uuid, "type": "text", "title": "...", titre + paragraphe libre
  --     "body": "..." }
  -- Le mode custom exige exactement un bloc "form" ; les "image" sont illimités.
  landing_blocks jsonb not null default '[]'::jsonb,
  -- Options d'affichage du mode custom (sans effet en mode simple)
  landing_theme text not null default 'light'
    check (landing_theme in ('light','dark')),
  landing_sticky_cta boolean not null default true,
  landing_sticky_header boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_slug_idx on public.product (slug);
-- Le domaine est stocké normalisé, mais l'index reste sur `lower()` : une
-- écriture manuelle en base ne doit pas pouvoir créer deux fois le même
-- domaine et rendre la résolution d'hôte ambiguë.
create unique index if not exists product_domain_idx
  on public.product (lower(domain)) where domain is not null;
create index if not exists product_owner_idx on public.product (owner_id);

-- ── Commandes ──────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Boutique d'origine. `on delete set null` : supprimer un produit ne doit
  -- pas effacer les commandes qu'il a générées.
  product_id uuid references public.product(id) on delete set null,
  -- Nom du produit figé à la commande : renommer ou supprimer le produit ne
  -- réécrit pas l'historique.
  product_name text,
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
create index if not exists orders_product_idx on public.orders (product_id);

-- ── Paramètres de la plateforme (une seule ligne) ──────────────────────────
-- Tout ce qui n'appartient pas à une boutique en particulier.
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  -- Identité affichée dans l'admin (pas sur les landings)
  store_name text not null default 'Ma Boutique',
  logo_url text,
  from_wilaya text not null default '16 - Alger',
  -- Produit servi quand l'hôte ne correspond à aucun domaine (le domaine
  -- Vercel du projet, par exemple). Null = 404 sur ces hôtes.
  default_product_id uuid references public.product(id) on delete set null,
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
insert into public.product (slug, name) select 'mon-produit', 'Mon Produit'
  where not exists (select 1 from public.product);
insert into public.settings (store_name, default_product_id)
  select 'Ma Boutique', (select id from public.product order by created_at limit 1)
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
