import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-y border-b border-line bg-transparent py-2 text-ink outline-none placeholder:text-quiet focus:border-ink",
        className,
      )}
      {...props}
    />
  );
}
