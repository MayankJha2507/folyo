import { cn } from "@/lib/utils";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  invalid?: boolean;
}

export function Textarea({ className, invalid = false, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full rounded-md border bg-canvas px-3 py-2 text-ink",
        "placeholder:text-ink-subtle",
        "transition-colors duration-100",
        "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted",
        invalid ? "border-critical" : "border-line-strong",
        className,
      )}
      {...props}
    />
  );
}
