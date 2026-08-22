-- Migration 011 : brouillons (paniers abandonnés)
-- Ce que le visiteur a saisi dans le formulaire sans jamais l'envoyer.
-- À exécuter dans Supabase : SQL Editor > New query > Run.

create table if not exists public.drafts (
  -- Généré par le navigateur et conservé le temps de l'onglet : chaque
  -- visiteur n'occupe qu'une ligne, réécrite à chaque frappe plutôt qu'une
  -- ligne par caractère tapé.
  id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Tous les champs sont nullables : un brouillon est par nature incomplet.
  customer_name text,
  phone text,
  wilaya text,
  address text,
  delivery_type text,
  stopdesk_name text,
  color text,
  size text,
  quantity int not null default 1,
  total numeric
);

-- La page admin liste du plus récemment modifié au plus ancien
create index if not exists drafts_updated_at_idx on public.drafts (updated_at desc);

-- Sécurité : comme les autres tables, aucun accès public.
-- Les écritures passent par /api/draft avec la clé service_role côté serveur.
alter table public.drafts enable row level security;
