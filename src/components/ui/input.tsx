import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full border-b border-line bg-transparent py-2 text-ink outline-none placeholder:text-quiet focus:border-ink",
        className,
      )}
      {...props}
    />
  );
}
