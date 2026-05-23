/**
 * lib/download.ts
 * ─────────────────────────────────────────────────────────────
 * Logique de téléchargement : unitaire (streaming) + ZIP (JSZip).
 * Compatible Instagram ET TikTok (UnifiedMedia).
 */

import JSZip from "jszip";
import type { UnifiedMedia, UnifiedDownloadItem, PlatformType } from "@/types/media";
import { getUnifiedFilename, getZipFilename } from "@/lib/utils/platform";

// ─── Proxy URL ────────────────────────────────────────────────────────────────

/**
 * Construit l'URL proxy pour contourner les restrictions CORS des CDN.
 */
export function buildProxyUrl(mediaUrl: string): string {
  return `/api/proxy?url=${encodeURIComponent(mediaUrl)}`;
}

// ─── Téléchargement unitaire (streaming avec progression) ────────────────────

/**
 * Télécharge un fichier via le proxy avec suivi de progression.
 * Utilise ReadableStream pour afficher le % en temps réel.
 */
export async function downloadSingleMedia(
  item: UnifiedDownloadItem,
  onProgress: (progress: number) => void
): Promise<Blob> {
  const response = await fetch(item.url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);

  const contentLength = response.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) {
      onProgress(Math.round((received / total) * 100));
    } else {
      // Progression indéterminée
      onProgress(Math.min(95, Math.round(received / 10000)));
    }
  }

  onProgress(100);
  return new Blob(chunks as BlobPart[]);
}

// ─── Déclenchement du téléchargement navigateur ───────────────────────────────

/**
 * Déclenche le téléchargement d'un Blob dans le navigateur.
 */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Libérer l'URL object après 10s
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ─── ZIP Download ─────────────────────────────────────────────────────────────

/**
 * Télécharge une liste de médias et les compresse en un seul fichier ZIP.
 * Supporte les carrousels (chaque slide devient un fichier séparé).
 *
 * @param platform  "instagram" | "tiktok"
 * @param username  Nom d'utilisateur (pour le nommage)
 * @param media     Liste des médias UnifiedMedia
 * @param onProgress Callback de progression (current, total, label)
 */
export async function downloadAsZip(
  platform: PlatformType,
  username: string,
  media: UnifiedMedia[],
  onProgress: (current: number, total: number, label: string) => void
): Promise<void> {
  const zip = new JSZip();
  const folderName = `${username}_${platform}`;
  const folder = zip.folder(folderName) ?? zip;

  for (let i = 0; i < media.length; i++) {
    const item = media[i];
    onProgress(i, media.length, item.type);

    try {
      if (item.type === "carousel" && item.children?.length) {
        // Carrousel : chaque slide dans un fichier séparé
        for (let j = 0; j < item.children.length; j++) {
          const child = item.children[j];
          const url = child.video_url ?? child.url;
          if (!url) continue;

          const res = await fetch(buildProxyUrl(url));
          if (!res.ok) continue;

          const blob = await res.blob();
          const filename = getUnifiedFilename(platform, username, item.id, child.type, j + 1);
          folder.file(filename, blob);
        }
      } else {
        // Photo ou vidéo simple
        const url = item.video_url ?? item.url;
        if (!url) continue;

        const res = await fetch(buildProxyUrl(url));
        if (!res.ok) continue;

        const blob = await res.blob();
        const filename = getUnifiedFilename(platform, username, item.id, item.type);
        folder.file(filename, blob);
      }
    } catch {
      // On saute les médias qui échouent
    }
  }

  onProgress(media.length, media.length, "generating");
  const zipBlob = await zip.generateAsync({ type: "blob" });
  triggerBrowserDownload(zipBlob, getZipFilename(platform, username));
}
