-- Migration 016 — retrait des colonnes de vitrine restées dans `settings`
-- À jouer APRÈS avoir déployé le code multi-produits, pas avant : la version
-- précédente du site lit encore ces colonnes, et les supprimer trop tôt
-- casserait la landing en ligne le temps du déploiement.
--
-- La migration 015 a déjà recopié ces valeurs sur le produit existant.

alter table public.settings
  drop column if exists primary_color,
  drop column if exists pixel_id,
  drop column if exists fb_domain_verification,
  drop column if exists free_delivery_mode,
  drop column if exists landing_mode,
  drop column if exists landing_blocks,
  drop column if exists landing_theme,
  drop column if exists landing_sticky_cta,
  drop column if exists landing_sticky_header;
