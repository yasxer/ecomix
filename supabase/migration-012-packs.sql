-- Migration 012 : packs (offres groupées)
-- Le produit reste unique, mais il peut se vendre par lots : « 1 pièce à
-- 2 500 DA / 2 pièces à 4 000 DA / 3 pièces à 5 500 DA ». Chaque pack a sa
-- son prix, et son propre traitement visuel sur la landing.
-- À exécuter dans Supabase : SQL Editor > New query > Run.

-- Un pack : { id, label, quantity, price, old_price, badge, highlight }
-- `quantity` est le nombre de pièces, `price` le prix total du lot (pas
-- unitaire), et `highlight` vaut 'none' | 'badge' | 'border'.
-- Défaut vide : tant qu'aucun pack n'est saisi, la landing garde son
-- sélecteur de quantité et son calcul prix × quantité.
alter table public.product
  add column if not exists packs jsonb not null default '[]'::jsonb;

-- Le pack retenu, figé au moment de la commande : renommer un pack dans
-- l'admin ne doit pas réécrire l'historique. Null = commande sans pack.
alter table public.orders add column if not exists pack_label text;

-- Variante de chaque pièce : [{ "color": "Noir", "size": "M" }, ...]
-- Un pack de 2 pièces produit 2 entrées, le client choisissant couleur et
-- taille pièce par pièce. Les colonnes `color` / `size` restent renseignées
-- avec le résumé des valeurs distinctes ("Noir, Blanc") : les anciennes
-- lignes et les cellules compactes du tableau continuent de s'afficher sans
-- cas particulier.
alter table public.orders
  add column if not exists items jsonb not null default '[]'::jsonb;

-- Mêmes colonnes sur les brouillons : savoir quel pack regardait le visiteur
-- qui n'a pas validé est justement l'intérêt de la page paniers abandonnés.
alter table public.drafts add column if not exists pack_label text;
alter table public.drafts
  add column if not exists items jsonb not null default '[]'::jsonb;
