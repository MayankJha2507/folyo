import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  invalid?: boolean;
}

export function Input({ className, invalid = false, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "h-9 w-full rounded-md border bg-canvas px-3 text-ink",
        "placeholder:text-ink-subtle",
        "transition-colors duration-100",
        "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted",
        invalid ? "border-critical" : "border-line-strong hover:border-line-strong",
        className,
      )}
      {...props}
    />
  );
}
