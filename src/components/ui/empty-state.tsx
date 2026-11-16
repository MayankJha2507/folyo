import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.ComponentProps<"div"> {
  title: string;
  /** One sentence saying what this is for and what happens next. */
  description: string;
  action?: React.ReactNode;
}

/**
 * The brief calls for clear empty states, so they are a primitive rather than
 * something each page improvises.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg",
        "border border-dashed border-line-strong bg-surface px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      <h3 className="text-[0.9375rem] font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-ink-muted">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
