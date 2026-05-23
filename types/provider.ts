/**
 * types/provider.ts
 * ─────────────────────────────────────────────────────────────
 * Interface commune à tous les providers de plateforme.
 * Permet d'ajouter YouTube, Twitter/X, Facebook, etc. facilement.
 */

import type { UnifiedProfile, UnifiedMedia, PlatformType } from "./media";

export interface PageResult {
  media: UnifiedMedia[];
  has_next_page: boolean;
  end_cursor?: string;
  platform: PlatformType;
}

export interface MediaProvider {
  /** Identifiant de la plateforme */
  readonly platform: PlatformType;

  /** Retourne true si l'input correspond à cette plateforme */
  detect(input: string): boolean;

  /**
   * Récupère le profil + les premiers médias.
   * Pour TikTok : input = URL d'une vidéo.
   * Pour Instagram : input = @username ou URL de profil.
   */
  fetchProfile(input: string): Promise<UnifiedProfile>;

  /**
   * Pagination optionnelle (Instagram seulement pour l'instant).
   */
  fetchNextPage?(userId: string, cursor: string): Promise<PageResult>;
}
