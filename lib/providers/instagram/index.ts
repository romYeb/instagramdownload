/**
 * lib/providers/instagram/index.ts
 * ─────────────────────────────────────────────────────────────
 * Provider Instagram — wraps lib/instagram.ts et normalise
 * en UnifiedProfile / UnifiedMedia pour l'architecture multi-plateforme.
 *
 * La logique de scraping reste dans lib/instagram.ts (inchangée).
 */

import {
  fetchInstagramProfile as _fetchProfile,
  fetchNextPage as _fetchNextPage,
} from "@/lib/instagram";
import type { InstagramMedia, InstagramUser } from "@/types/instagram";
import type {
  UnifiedProfile,
  UnifiedMedia,
  UnifiedUser,
  UnifiedMediaChild,
} from "@/types/media";
import type { MediaProvider, PageResult } from "@/types/provider";
import { extractInstagramUsername } from "@/lib/utils/platform";

// ─── Adaptateurs ─────────────────────────────────────────────────────────────

function adaptUser(user: InstagramUser): UnifiedUser {
  return {
    id: user.id,
    platform: "instagram",
    username: user.username,
    display_name: user.full_name || user.username,
    biography: user.biography,
    avatar_url: user.profile_pic_url,
    follower_count: user.follower_count,
    following_count: user.following_count,
    media_count: user.media_count,
    is_private: user.is_private,
    is_verified: user.is_verified,
    profile_url: `https://www.instagram.com/${user.username}`,
    external_url: user.external_url,
    category: user.category,
  };
}

function adaptChild(child: NonNullable<InstagramMedia["children"]>[number]): UnifiedMediaChild {
  return {
    id: child.id,
    type: child.type,
    url: child.url,
    thumbnail_url: child.thumbnail_url,
    video_url: child.video_url,
    dimensions: child.dimensions,
  };
}

function adaptMedia(media: InstagramMedia): UnifiedMedia {
  return {
    id: media.id,
    platform: "instagram",
    shortcode: media.shortcode,
    type: media.type,
    url: media.url,
    thumbnail_url: media.thumbnail_url,
    video_url: media.video_url,
    caption: media.caption,
    like_count: media.like_count,
    comment_count: media.comment_count,
    timestamp: media.timestamp,
    children: media.children?.map(adaptChild),
    dimensions: media.dimensions,
    duration: media.duration,
    is_reel: media.is_reel,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const InstagramProvider: MediaProvider = {
  platform: "instagram",

  detect(input: string): boolean {
    return (
      /instagram\.com/i.test(input) ||
      /instagr\.am/i.test(input) ||
      (!input.includes("/") && /^[@]?[a-zA-Z0-9._]{1,30}$/.test(input.trim()))
    );
  },

  async fetchProfile(input: string): Promise<UnifiedProfile> {
    const username = extractInstagramUsername(input);
    if (!username) throw new Error("Invalid Instagram username or URL");

    const raw = await _fetchProfile(username);

    return {
      platform: "instagram",
      user: adaptUser(raw.user),
      media: raw.media.map(adaptMedia),
      has_next_page: raw.has_next_page,
      end_cursor: raw.end_cursor,
      total_count: raw.user.media_count,
    };
  },

  async fetchNextPage(userId: string, cursor: string): Promise<PageResult> {
    const raw = await _fetchNextPage(userId, cursor);
    return {
      platform: "instagram",
      media: raw.media.map(adaptMedia),
      has_next_page: raw.has_next_page,
      end_cursor: raw.end_cursor,
    };
  },
};

// ─── Exports nommés pratiques ─────────────────────────────────────────────────

export async function fetchInstagramProfile(username: string): Promise<UnifiedProfile> {
  const raw = await _fetchProfile(username);
  return {
    platform: "instagram",
    user: adaptUser(raw.user),
    media: raw.media.map(adaptMedia),
    has_next_page: raw.has_next_page,
    end_cursor: raw.end_cursor,
    total_count: raw.user.media_count,
  };
}

export async function fetchInstagramNextPage(userId: string, cursor: string): Promise<PageResult> {
  const raw = await _fetchNextPage(userId, cursor);
  return {
    platform: "instagram",
    media: raw.media.map(adaptMedia),
    has_next_page: raw.has_next_page,
    end_cursor: raw.end_cursor,
  };
}
