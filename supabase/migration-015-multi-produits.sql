-- Migration 015 — plusieurs produits, un domaine chacun
-- À exécuter dans Supabase : SQL Editor > New query > Run (une seule fois).
--
-- Avant : une ligne `product`, une ligne `settings`, et la vitrine (nom,
-- logo, couleur, pixel, landing) vivait dans `settings`.
-- Après : `product` porte plusieurs lignes, chacune avec son domaine et sa
-- propre vitrine. `settings` ne garde que ce qui est commun à la plateforme
-- (identité de l'admin, wilaya d'expédition, produit servi par défaut).

-- ── 1. Produit : identité de boutique ──────────────────────────────────────
alter table public.product
  -- Clé lisible : sert d'aperçu (/p/mon-produit) tant que le domaine n'est
  -- pas branché, et de repli si le DNS tombe.
  add column if not exists slug text,
  -- Domaine dédié, en minuscules et sans "www." (voir `normalizeDomain`).
  -- Null = produit accessible seulement par son slug.
  add column if not exists domain text,
  -- Un produit inactif n'est plus servi ni commandable, sans être supprimé.
  add column if not exists active boolean not null default true,
  -- Préparation du multi-comptes : null = le propriétaire de la plateforme.
  -- Le jour du passage en SaaS, cette colonne portera l'id du vendeur, les
  -- identifiants Yalidine/Telegram passeront dans une table `owners`, et les
  -- policies RLS s'appuieront dessus. Rien d'autre du schéma ne bouge.
  add column if not exists owner_id uuid,
  add column if not exists created_at timestamptz not null default now(),
  -- ── Vitrine (déplacée depuis `settings`) ──
  add column if not exists store_name text not null default 'Ma Boutique',
  add column if not exists logo_url text,
  add column if not exists primary_color text not null default '#4f46e5',
  add column if not exists pixel_id text,
  add column if not exists fb_domain_verification text,
  add column if not exists free_delivery_mode text not null default 'none',
  add column if not exists landing_mode text not null default 'simple',
  add column if not exists landing_blocks jsonb not null default '[]'::jsonb,
  add column if not exists landing_theme text not null default 'light',
  add column if not exists landing_sticky_cta boolean not null default true,
  add column if not exists landing_sticky_header boolean not null default true;

-- Reprise des réglages de vitrine existants sur le produit déjà en base.
-- Le bloc dynamique ne s'exécute que si les colonnes sont encore dans
-- `settings` : rejouer la migration ne casse rien.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'settings'
      and column_name = 'landing_blocks'
  ) then
    execute $copy$
      update public.product p set
        store_name = s.store_name,
        logo_url = s.logo_url,
        primary_color = s.primary_color,
        pixel_id = s.pixel_id,
        fb_domain_verification = s.fb_domain_verification,
        free_delivery_mode = s.free_delivery_mode,
        landing_mode = s.landing_mode,
        landing_blocks = s.landing_blocks,
        landing_theme = s.landing_theme,
        landing_sticky_cta = s.landing_sticky_cta,
        landing_sticky_header = s.landing_sticky_header
      from public.settings s
      where p.slug is null
    $copy$;
  end if;
end $$;

-- Slug dérivé du nom ; repli sur l'id quand le nom ne donne rien
-- d'utilisable (nom en arabe, par exemple).
update public.product
set slug = coalesce(
  nullif(btrim(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), '-'), ''),
  'produit-' || left(replace(id::text, '-', ''), 6)
)
where slug is null;

-- Deux produits homonymes ne peuvent pas partager le même slug
update public.product p
set slug = p.slug || '-' || left(replace(p.id::text, '-', ''), 6)
where exists (
  select 1 from public.product q where q.slug = p.slug and q.id <> p.id
);

alter table public.product alter column slug set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_slug_format'
  ) then
    alter table public.product add constraint product_slug_format
      check (slug ~ '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'product_free_delivery_mode_check'
  ) then
    alter table public.product add constraint product_free_delivery_mode_check
      check (free_delivery_mode in ('none','all','stopdesk'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'product_landing_mode_check'
  ) then
    alter table public.product add constraint product_landing_mode_check
      check (landing_mode in ('simple','custom'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'product_landing_theme_check'
  ) then
    alter table public.product add constraint product_landing_theme_check
      check (landing_theme in ('light','dark'));
  end if;
end $$;

create unique index if not exists product_slug_idx on public.product (slug);
-- Le domaine est stocké normalisé, mais l'index reste sur `lower()` : une
-- écriture manuelle en base ne doit pas pouvoir créer deux fois le même
-- domaine et rendre la résolution d'hôte ambiguë.
create unique index if not exists product_domain_idx
  on public.product (lower(domain)) where domain is not null;
create index if not exists product_owner_idx on public.product (owner_id);

-- ── 2. Settings : plateforme uniquement ────────────────────────────────────
-- Produit servi quand l'hôte ne correspond à aucun domaine (le domaine
-- Vercel du projet, par exemple). Null = 404 sur ces hôtes.
alter table public.settings
  add column if not exists default_product_id uuid
    references public.product(id) on delete set null;

update public.settings s
set default_product_id = (
  select p.id from public.product p order by p.created_at limit 1
)
where s.default_product_id is null;

-- Les anciennes colonnes de vitrine restent en place le temps du
-- déploiement : le code encore en ligne les lit toujours. Elles sont
-- supprimées par la migration 016, à jouer une fois le nouveau code déployé.

-- ── 3. Commandes : à quelle boutique appartient la commande ────────────────
alter table public.orders
  add column if not exists product_id uuid
    references public.product(id) on delete set null,
  -- Nom du produit figé à la commande : supprimer un produit ne doit pas
  -- effacer l'historique, et renommer ne doit pas réécrire le passé.
  add column if not exists product_name text;

update public.orders o
set product_id = (select p.id from public.product p order by p.created_at limit 1)
where o.product_id is null;

update public.orders o
set product_name = p.name
from public.product p
where o.product_id = p.id and o.product_name is null;

create index if not exists orders_product_idx on public.orders (product_id);
