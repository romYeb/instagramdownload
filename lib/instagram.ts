import type { InstagramProfile, InstagramMedia, MediaType } from "@/types/instagram";

const IG_APP_ID = "936619743392459";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://www.instagram.com/",
  Origin: "https://www.instagram.com",
  "X-IG-App-ID": IG_APP_ID,
  "X-ASBD-ID": "198387",
  "X-IG-WWW-Claim": "0",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMediaNode(node: any): InstagramMedia {
  const typename: string = node.__typename || "";
  let type: MediaType = "image";

  if (typename === "GraphVideo" || node.is_video) {
    type = node.product_type === "clips" ? "reel" : "video";
  } else if (typename === "GraphSidecar") {
    type = "carousel";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children = node.edge_sidecar_to_children?.edges?.map((e: any) => {
    const child = e.node;
    return {
      id: child.id,
      type: child.is_video ? "video" : "image",
      url: child.display_url,
      thumbnail_url: child.display_url,
      video_url: child.video_url,
      dimensions: child.dimensions,
    };
  });

  return {
    id: node.id,
    shortcode: node.shortcode,
    type,
    url: node.display_url || node.thumbnail_src,
    thumbnail_url: node.thumbnail_src || node.display_url,
    video_url: node.video_url,
    caption: node.edge_media_to_caption?.edges?.[0]?.node?.text,
    timestamp: node.taken_at_timestamp,
    like_count: node.edge_liked_by?.count ?? node.edge_media_preview_like?.count ?? 0,
    comment_count: node.edge_media_to_comment?.count ?? 0,
    children,
    dimensions: node.dimensions,
    duration: node.video_duration,
    is_reel: type === "reel",
  };
}

async function fetchViaWebProfileInfo(username: string): Promise<InstagramProfile> {
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;

  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  const user = json?.data?.user;
  if (!user) throw new Error("No user data");

  const edges = user.edge_owner_to_timeline_media?.edges ?? [];
  const pageInfo = user.edge_owner_to_timeline_media?.page_info ?? {};

  return {
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      biography: user.biography,
      profile_pic_url: user.profile_pic_url_hd || user.profile_pic_url,
      follower_count: user.edge_followed_by?.count ?? 0,
      following_count: user.edge_follow?.count ?? 0,
      media_count: user.edge_owner_to_timeline_media?.count ?? 0,
      is_private: user.is_private,
      is_verified: user.is_verified,
      external_url: user.external_url,
      category: user.category_name,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media: edges.map((e: any) => parseMediaNode(e.node)),
    has_next_page: pageInfo.has_next_page ?? false,
    end_cursor: pageInfo.end_cursor,
  };
}

async function fetchViaGraphQL(username: string): Promise<InstagramProfile> {
  // Get user ID first via the /web_profile_info endpoint JSON variant
  const userRes = await fetch(
    `https://www.instagram.com/${encodeURIComponent(username)}/?__a=1&__d=dis`,
    {
      headers: {
        ...BROWSER_HEADERS,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!userRes.ok) throw new Error(`HTTP ${userRes.status}`);
  const data = await userRes.json();
  const user = data?.graphql?.user ?? data?.user;
  if (!user) throw new Error("No user data in GraphQL response");

  const edges = user.edge_owner_to_timeline_media?.edges ?? [];
  const pageInfo = user.edge_owner_to_timeline_media?.page_info ?? {};

  return {
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      biography: user.biography,
      profile_pic_url: user.profile_pic_url_hd || user.profile_pic_url,
      follower_count: user.edge_followed_by?.count ?? 0,
      following_count: user.edge_follow?.count ?? 0,
      media_count: user.edge_owner_to_timeline_media?.count ?? 0,
      is_private: user.is_private,
      is_verified: user.is_verified,
      external_url: user.external_url,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media: edges.map((e: any) => parseMediaNode(e.node)),
    has_next_page: pageInfo.has_next_page ?? false,
    end_cursor: pageInfo.end_cursor,
  };
}

export async function fetchInstagramProfile(username: string): Promise<InstagramProfile> {
  const errors: string[] = [];

  // Strategy 1: Web profile info API
  try {
    return await fetchViaWebProfileInfo(username);
  } catch (e) {
    errors.push(`WebProfileInfo: ${e instanceof Error ? e.message : e}`);
  }

  // Strategy 2: Legacy GraphQL endpoint
  try {
    return await fetchViaGraphQL(username);
  } catch (e) {
    errors.push(`GraphQL: ${e instanceof Error ? e.message : e}`);
  }

  throw new Error(
    `Unable to fetch Instagram profile for @${username}. ` +
      `Instagram may require authentication or is blocking this request. ` +
      `Details: ${errors.join("; ")}`
  );
}
