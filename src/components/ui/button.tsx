import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-mono text-sm underline-offset-4 disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        text: "hover:underline",
        line: "border border-ink px-3 py-2 hover:bg-ink hover:text-paper",
      },
    },
    defaultVariants: { variant: "text" },
  },
);

export function Button({
  className,
  variant,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant }), className)} {...props} />;
}
