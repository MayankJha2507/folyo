import { Children, cloneElement, isValidElement } from "react";

import { cn } from "@/lib/utils";

type SlotProps = React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode };

/**
 * Minimal `asChild` implementation: merges our props onto the single child
 * element rather than rendering a wrapper. Avoids a Radix dependency for the
 * one behaviour we actually need.
 */
export function Slot({ children, className, ...slotProps }: SlotProps) {
  const child = Children.only(children);
  if (!isValidElement<React.HTMLAttributes<HTMLElement>>(child)) return null;

  return cloneElement(child, {
    ...slotProps,
    ...child.props,
    className: cn(className, child.props.className),
  });
}
