import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/canvas/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
  {
    variants: {
      variant: {
        default: "bg-secondary text-muted-foreground border-border",
        secondary: "bg-secondary text-secondary-foreground border-border",
        outline: "border-border text-foreground",
        destructive: "bg-destructive/15 text-destructive border-destructive/40",
        success: "bg-success/15 text-success border-success/40",
        warning: "bg-warning/15 text-warning border-warning/40",
        info: "bg-info/15 text-info border-info/40",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
