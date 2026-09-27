import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-xl bg-muted", className)} {...props} />;
}

function Progress({ value, className, color }: { value: number; className?: string; color?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center", className)}>
      <div className="mb-1 rounded-full bg-accent p-3 text-accent-foreground">
        <Icon className="size-5" />
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-xs text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

function SectionTitle({ children, count, action, className }: { children: React.ReactNode; count?: number; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2 flex items-center justify-between gap-2 px-1", className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {children}
        {count !== undefined && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium normal-case tracking-normal">{count}</span>
        )}
      </h2>
      {action}
    </div>
  );
}

export { EmptyState, Progress, SectionTitle, Skeleton };
