import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CopyableIdProps {
  value: string;
  label: string;
  className?: string;
}

/** Shows an ID (e.g. a Chai ID) with a one-click copy. */
export function CopyableId({ value, label, className }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure context): the full ID stays visible to select by hand */
    }
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{value}</code>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${label}`}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
