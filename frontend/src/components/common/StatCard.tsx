import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "danger" | "warning";

const toneClass: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
};

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  /** Makes the card a link to the underlying records. */
  to?: string;
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default", to }: StatCardProps) {
  const body = (
    <Card className={cn("h-full p-4", to && "transition-colors hover:border-primary/40 hover:bg-muted/30")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden />}
      </div>
      <p className={cn("mt-2 break-words text-2xl font-bold tabular-nums", toneClass[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
  return to ? (
    <Link to={to} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}
