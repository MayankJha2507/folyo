import { Slot } from "@/components/ui/slot";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-accent text-ink-inverse border-transparent hover:bg-accent-hover active:bg-accent-active",
  secondary:
    "bg-canvas text-ink border-line-strong hover:bg-surface active:bg-surface-sunken",
  ghost:
    "bg-transparent text-ink-muted border-transparent hover:bg-surface hover:text-ink",
  danger:
    "bg-canvas text-critical border-line-strong hover:bg-critical-subtle hover:border-critical",
} as const;

const sizes = {
  sm: "h-8 px-2.5 text-[0.8125rem] gap-1.5",
  md: "h-9 px-3.5 gap-2",
  lg: "h-10 px-4 gap-2",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render the single child element instead of a <button>, keeping the styles. */
  asChild?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      type={asChild ? undefined : type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border font-medium whitespace-nowrap",
        "transition-colors duration-100",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
