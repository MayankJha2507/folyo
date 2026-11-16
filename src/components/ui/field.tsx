import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("text-[0.8125rem] font-medium text-ink", className)}
      {...props}
    />
  );
}

export interface FieldProps extends React.ComponentProps<"div"> {
  label: string;
  htmlFor: string;
  /** Guidance shown under the control; hidden while an error is present. */
  hint?: string;
  error?: string;
  optional?: boolean;
}

/** Label + control + one message slot, so forms stay vertically consistent. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional = false,
  className,
  children,
  ...props
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {optional ? (
          <span className="text-xs text-ink-subtle">Optional</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-critical">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
