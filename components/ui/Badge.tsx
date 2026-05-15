import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "purple" | "blue" | "green" | "orange" | "red";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-surface-3 text-text-secondary border border-border": variant === "default",
          "bg-primary/10 text-primary border border-primary/20": variant === "purple",
          "bg-accent/10 text-accent border border-accent/20": variant === "blue",
          "bg-success/10 text-success border border-success/20": variant === "green",
          "bg-warning/10 text-warning border border-warning/20": variant === "orange",
          "bg-error/10 text-error border border-error/20": variant === "red",
        },
        className
      )}
    >
      {children}
    </span>
  );
}
