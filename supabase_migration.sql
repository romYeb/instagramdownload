-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : ajout du champ "platform" à download_history
-- Applique dans Supabase SQL Editor → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Ajouter la colonne "platform" (optionnelle pour rétrocompatibilité)
ALTER TABLE download_history
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'instagram';

-- Contrainte de validation
ALTER TABLE download_history
  ADD CONSTRAINT platform_valid
  CHECK (platform IN ('instagram', 'tiktok'));

-- Index pour filtrer par plateforme
CREATE INDEX IF NOT EXISTS idx_download_history_platform
  ON download_history (platform);

-- Vérification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'download_history'
ORDER BY ordinal_position;
