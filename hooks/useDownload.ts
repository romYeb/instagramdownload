"use client";
import { useState, useCallback, useRef } from "react";
import type { InstagramMedia, DownloadItem } from "@/types/instagram";
import {
  downloadSingleMedia,
  downloadAsZip,
  triggerBrowserDownload,
  buildProxyUrl,
} from "@/lib/download";
import { getMediaFilename } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

type ZipState =
  | { status: "idle" }
  | { status: "zipping"; current: number; total: number; label: string }
  | { status: "done" }
  | { status: "error"; message: string };

export function useDownload(username: string) {
  const [items, setItems] = useState<Map<string, DownloadItem>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [zipState, setZipState] = useState<ZipState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const updateItem = useCallback((id: string, patch: Partial<DownloadItem>) => {
    setItems((prev) => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) next.set(id, { ...existing, ...patch });
      return next;
    });
  }, []);

  const downloadOne = useCallback(
    async (media: InstagramMedia) => {
      const url =
        media.type === "video" || media.type === "reel"
          ? media.video_url || media.url
          : media.url;

      const item: DownloadItem = {
        id: uuidv4(),
        mediaId: media.id,
        url: buildProxyUrl(url),
        filename: getMediaFilename(username, media.id, media.type),
        type: media.type,
        status: "downloading",
        progress: 0,
      };

      setItems((prev) => new Map(prev).set(item.id, item));

      try {
        const blob = await downloadSingleMedia(item, (progress) => {
          updateItem(item.id, { progress });
        });
        updateItem(item.id, { status: "done", progress: 100, blob });
        triggerBrowserDownload(blob, item.filename);
      } catch {
        updateItem(item.id, { status: "error" });
      }
    },
    [username, updateItem]
  );

  const downloadSelected = useCallback(
    async (allMedia: InstagramMedia[]) => {
      const toDownload =
        selected.size > 0
          ? allMedia.filter((m) => selected.has(m.id))
          : allMedia;

      if (toDownload.length === 0) return;

      setZipState({ status: "zipping", current: 0, total: toDownload.length, label: "image" });

      try {
        await downloadAsZip(username, toDownload, (current, total, label) => {
          setZipState({ status: "zipping", current, total, label });
        });
        setZipState({ status: "done" });
        setTimeout(() => setZipState({ status: "idle" }), 3000);
      } catch (e) {
        setZipState({
          status: "error",
          message: e instanceof Error ? e.message : "ZIP generation failed",
        });
      }
    },
    [username, selected]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((media: InstagramMedia[]) => {
    setSelected(new Set(media.map((m) => m.id)));
  }, []);

  const clearSelected = useCallback(() => setSelected(new Set()), []);

  const cancelZip = useCallback(() => {
    abortRef.current?.abort();
    setZipState({ status: "idle" });
  }, []);

  return {
    items,
    selected,
    zipState,
    downloadOne,
    downloadSelected,
    toggleSelect,
    selectAll,
    clearSelected,
    cancelZip,
  };
}
