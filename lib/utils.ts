import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function extractUsername(input: string): string | null {
  input = input.trim();

  // Direct username (no slashes)
  if (!input.includes("/") && /^[a-zA-Z0-9._]{1,30}$/.test(input)) {
    return input.toLowerCase();
  }

  // Instagram URL patterns
  const patterns = [
    /instagram\.com\/([a-zA-Z0-9._]{1,30})\/?/,
    /instagram\.com\/([a-zA-Z0-9._]{1,30})\?/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      const username = match[1];
      if (!["p", "reel", "stories", "explore", "accounts"].includes(username)) {
        return username.toLowerCase();
      }
    }
  }

  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getMediaFilename(
  username: string,
  mediaId: string,
  type: string,
  index?: number
): string {
  const ext = type === "video" || type === "reel" ? "mp4" : "jpg";
  const suffix = index !== undefined ? `_${index}` : "";
  return `${username}_${mediaId}${suffix}.${ext}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
