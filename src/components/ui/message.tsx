import type { ComponentProps, HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant";
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-end justify-end gap-2 py-3",
      from === "user" ? "is-user" : "is-assistant flex-row-reverse justify-end",
      className,
    )}
    {...props}
  />
);

const messageContentVariants = cva("flex flex-col gap-1 overflow-hidden text-sm", {
  variants: {
    variant: {
      contained: [
        "max-w-[80%] px-4 py-3",
        "group-[.is-user]:bg-ink group-[.is-user]:text-paper",
        "group-[.is-assistant]:bg-paper group-[.is-assistant]:text-ink",
      ],
      flat: [
        "group-[.is-user]:max-w-[80%] group-[.is-user]:bg-paper group-[.is-user]:px-0 group-[.is-user]:py-0 group-[.is-user]:text-ink",
        "group-[.is-assistant]:text-ink",
      ],
    },
  },
  defaultVariants: { variant: "flat" },
});

export type MessageContentProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof messageContentVariants>;

export const MessageContent = ({ children, className, variant, ...props }: MessageContentProps) => (
  <div className={cn(messageContentVariants({ variant }), className)} {...props}>
    {children}
  </div>
);

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export const MessageAvatar = ({ src, name, className, ...props }: MessageAvatarProps) => (
  <Avatar className={cn("size-8", className)} {...props}>
    <AvatarImage alt="" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || "ME"}</AvatarFallback>
  </Avatar>
);
