-- Migration 014 : personnalisation de la landing page
-- Deux modes : 'simple' (la mise en page fixe actuelle) ou 'custom' (une
-- suite de blocs ordonnés composée dans l'admin).
-- À exécuter dans Supabase : SQL Editor > New query > Run.

alter table public.settings
  add column if not exists landing_mode text not null default 'simple'
    check (landing_mode in ('simple','custom'));

-- Blocs du mode custom, dans l'ordre d'affichage :
--   { "id": uuid, "type": "hero" }                       titre + prix + badges
--   { "id": uuid, "type": "gallery" }                    galerie des images produit
--   { "id": uuid, "type": "description" }                description + points forts
--   { "id": uuid, "type": "form" }                       offres groupées + formulaire
--   { "id": uuid, "type": "image", "url": "...",         image pleine largeur
--     "width": 1200, "height": 1600 }                    (dimensions pour éviter le CLS)
--   { "id": uuid, "type": "text", "title": "...",        titre + paragraphe libre
--     "body": "..." }
-- Le mode custom exige exactement un bloc "form" ; les blocs "image" sont
-- illimités.
alter table public.settings
  add column if not exists landing_blocks jsonb not null default '[]'::jsonb;

-- Options d'affichage du mode custom (sans effet en mode simple) :
--   landing_theme          'light' | 'dark'
--   landing_sticky_cta     bouton « Commander » flottant, visible sur toute la page
--   landing_sticky_header  en-tête qui reste collé en haut pendant le défilement
alter table public.settings
  add column if not exists landing_theme text not null default 'light'
    check (landing_theme in ('light','dark'));
alter table public.settings
  add column if not exists landing_sticky_cta boolean not null default true;
alter table public.settings
  add column if not exists landing_sticky_header boolean not null default true;
