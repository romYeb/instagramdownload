"use client";
import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { Search, X, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "./ui/Button";
import { cn } from "@/lib/utils";

interface URLInputProps {
  onAnalyze: (input: string) => void;
  loading?: boolean;
  error?: string;
  onClear?: () => void;
}

const EXAMPLES = [
  "https://www.instagram.com/relooking_byjoly/",
  "natgeo",
  "nasa",
];

export function URLInput({ onAnalyze, loading, error, onClear }: URLInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onAnalyze(value.trim());
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) onAnalyze(value.trim());
  };

  const handleClear = () => {
    setValue("");
    onClear?.();
    inputRef.current?.focus();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mx-auto max-w-2xl px-4"
    >
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            "relative flex items-center gap-2 rounded-2xl border bg-surface p-2 transition-all duration-200",
            error
              ? "border-error/40 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
              : "border-border focus-within:border-primary/40 focus-within:shadow-glow"
          )}
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface-3">
            <Search className="h-4 w-4 text-text-muted" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder="instagram.com/username ou @username..."
            className="flex-1 bg-transparent text-text-primary placeholder-text-muted outline-none text-sm sm:text-base"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={loading}
          />

          {value && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <Button
            type="submit"
            size="sm"
            loading={loading}
            disabled={!value.trim() || loading}
            className="flex-shrink-0 gap-1.5"
          >
            {loading ? "Analyse..." : (
              <>
                Analyser
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-start gap-2 rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Example links */}
      {!loading && !error && (
        <div className="mt-3 flex flex-wrap items-center gap-2 justify-center">
          <span className="text-xs text-text-muted">Exemples :</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => { setValue(ex); onAnalyze(ex); }}
              className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary hover:text-text-primary hover:border-primary/30 transition-colors"
            >
              {ex.replace("https://www.instagram.com/", "@").replace("/", "")}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
