import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-surface-sunken text-ink-muted border-line",
  accent: "bg-accent-subtle text-accent border-accent-line",
  positive: "bg-positive-subtle text-positive border-transparent",
  caution: "bg-caution-subtle text-caution border-transparent",
  critical: "bg-critical-subtle text-critical border-transparent",
} as const;

export type BadgeTone = keyof typeof tones;

export interface BadgeProps extends React.ComponentProps<"span"> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5",
        "text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
