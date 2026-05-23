"use client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Package,
  X,
  CheckCircle2,
  AlertCircle,
  Archive,
} from "lucide-react";
import { Button } from "./ui/Button";

interface ZipState {
  status: "idle" | "zipping" | "done" | "error";
  current?: number;
  total?: number;
  label?: string;
  message?: string;
}

interface DownloadPanelProps {
  selectedCount: number;
  totalCount: number;
  zipState: ZipState;
  onDownloadSelected: () => void;
  onDownloadAll: () => void;
  onCancelZip: () => void;
}

export function DownloadPanel({
  selectedCount,
  totalCount,
  zipState,
  onDownloadSelected,
  onDownloadAll,
  onCancelZip,
}: DownloadPanelProps) {
  const isZipping = zipState.status === "zipping";
  const progress =
    zipState.total && zipState.total > 0
      ? Math.round(((zipState.current ?? 0) / zipState.total) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-4xl px-4"
    >
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-purple-blue shadow-glow">
              <Archive className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">
                {selectedCount > 0
                  ? `${selectedCount} média${selectedCount > 1 ? "s" : ""} sélectionné${selectedCount > 1 ? "s" : ""}`
                  : `${totalCount} médias disponibles`}
              </p>
              <p className="text-xs text-text-secondary">
                Téléchargez individuellement ou en archive ZIP
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={onDownloadSelected}
              disabled={isZipping}
              className="flex-1 sm:flex-none"
            >
              <Download className="h-3.5 w-3.5" />
              {selectedCount > 0 ? `ZIP (${selectedCount})` : `ZIP tout (${totalCount})`}
            </Button>
          </div>
        </div>

        {/* ZIP Progress */}
        <AnimatePresence>
          {isZipping && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-sm font-medium text-text-primary">
                      {zipState.label === "generating"
                        ? "Génération du ZIP..."
                        : `Téléchargement ${zipState.current ?? 0}/${zipState.total ?? 0}...`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-primary font-medium">{progress}%</span>
                    <button
                      onClick={onCancelZip}
                      className="rounded-lg p-1 text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-purple-blue"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {zipState.status === "done" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="rounded-xl border border-success/20 bg-success/5 p-3 flex items-center gap-2 text-success text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Archive ZIP téléchargée avec succès !
              </div>
            </motion.div>
          )}

          {zipState.status === "error" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="rounded-xl border border-error/20 bg-error/5 p-3 flex items-center gap-2 text-error text-sm">
                <AlertCircle className="h-4 w-4" />
                {zipState.message ?? "Erreur lors de la génération du ZIP."}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
