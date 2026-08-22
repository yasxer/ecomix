-- Migration 013 : suppression des brouillons
-- La sauvegarde automatique et la page admin des paniers abandonnés ont été retirées.
-- À exécuter dans Supabase : SQL Editor > New query > Run.

drop table if exists public.drafts;