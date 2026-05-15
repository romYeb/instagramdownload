import JSZip from "jszip";
import type { InstagramMedia, DownloadItem } from "@/types/instagram";
import { getMediaFilename } from "./utils";

export function buildProxyUrl(mediaUrl: string): string {
  return `/api/proxy?url=${encodeURIComponent(mediaUrl)}`;
}

export async function downloadSingleMedia(
  item: DownloadItem,
  onProgress: (progress: number) => void
): Promise<Blob> {
  const proxyUrl = buildProxyUrl(item.url);

  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);

  const contentLength = response.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const chunks: Uint8Array<ArrayBufferLike>[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) onProgress(Math.round((received / total) * 100));
    else onProgress(Math.min(99, received / 10000)); // Indeterminate progress
  }

  onProgress(100);
  return new Blob(chunks as BlobPart[]);
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadAsZip(
  username: string,
  media: InstagramMedia[],
  onProgress: (current: number, total: number, label: string) => void
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(username) ?? zip;

  for (let i = 0; i < media.length; i++) {
    const item = media[i];
    onProgress(i, media.length, item.type);

    try {
      if (item.type === "carousel" && item.children?.length) {
        for (let j = 0; j < item.children.length; j++) {
          const child = item.children[j];
          const url = child.video_url || child.url;
          const res = await fetch(buildProxyUrl(url));
          if (!res.ok) continue;
          const blob = await res.blob();
          const filename = getMediaFilename(username, item.id, child.type, j + 1);
          folder.file(filename, blob);
        }
      } else {
        const url = item.video_url || item.url;
        const res = await fetch(buildProxyUrl(url));
        if (!res.ok) continue;
        const blob = await res.blob();
        const filename = getMediaFilename(username, item.id, item.type);
        folder.file(filename, blob);
      }
    } catch {
      // Skip failed items
    }
  }

  onProgress(media.length, media.length, "generating");
  const zipBlob = await zip.generateAsync({ type: "blob" });
  triggerBrowserDownload(zipBlob, `${username}_instagram.zip`);
}
