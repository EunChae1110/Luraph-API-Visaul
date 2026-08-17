"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "dark"}
      position="bottom-center"
      gap={8}
      offset={24}
      mobileOffset={16}
      visibleToasts={3}
      duration={2800}
      className="toaster group"
      icons={{
        success: <CheckIcon strokeWidth={2.25} />,
        info: <InfoIcon strokeWidth={2} />,
        warning: <TriangleAlertIcon strokeWidth={2} />,
        error: <OctagonXIcon strokeWidth={2} />,
        loading: <Loader2Icon strokeWidth={2} className="animate-spin" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "lph-toast group/toast relative flex w-auto max-w-[min(100vw-2rem,340px)] items-center gap-2.5 rounded-full border border-white/10 bg-zinc-900 px-4 py-2.5 text-zinc-100 shadow-[0_10px_30px_rgba(0,0,0,0.4)]",
          title: "text-[13px] leading-none font-medium tracking-tight text-zinc-100",
          description: "mt-1 text-xs leading-snug text-zinc-400",
          icon: "lph-toast-icon flex size-4 shrink-0 items-center justify-center text-zinc-100 [&_svg]:size-4",
          actionButton:
            "ml-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-950",
          cancelButton:
            "ml-1 rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300",
          closeButton: "hidden",
          success: "lph-toast-success",
          error: "lph-toast-error",
          warning: "lph-toast-warning",
          info: "lph-toast-info",
          loading: "lph-toast-loading",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
