export type MediaType = "image" | "video" | "carousel" | "reel";

export interface InstagramUser {
  id: string;
  username: string;
  full_name: string;
  biography: string;
  profile_pic_url: string;
  follower_count: number;
  following_count: number;
  media_count: number;
  is_private: boolean;
  is_verified: boolean;
  external_url: string | null;
  category?: string;
}

export interface MediaChild {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnail_url?: string;
  video_url?: string;
  dimensions?: { width: number; height: number };
}

export interface InstagramMedia {
  id: string;
  shortcode: string;
  type: MediaType;
  url: string;
  thumbnail_url?: string;
  video_url?: string;
  caption?: string;
  timestamp: number;
  like_count: number;
  comment_count: number;
  children?: MediaChild[];
  dimensions?: { width: number; height: number };
  duration?: number;
  is_reel?: boolean;
}

export interface InstagramProfile {
  user: InstagramUser;
  media: InstagramMedia[];
  has_next_page: boolean;
  end_cursor?: string;
}

export interface DownloadItem {
  id: string;
  mediaId: string;
  url: string;
  filename: string;
  type: MediaType;
  status: "pending" | "downloading" | "done" | "error";
  progress: number;
  size?: number;
  blob?: Blob;
}

export interface DownloadHistory {
  id: string;
  username: string;
  full_name?: string;
  profile_pic_url?: string;
  follower_count?: number;
  media_count: number;
  downloaded_at: string;
  session_id: string;
}

export type FilterType = "all" | "image" | "video" | "carousel" | "reel";
