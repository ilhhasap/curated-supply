import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "grid size-4 shrink-0 place-items-center border border-ink bg-paper data-[state=checked]:bg-ink",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="block size-1.5 bg-paper" />
    </CheckboxPrimitive.Root>
  );
}
