"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  IconHistory,
  IconLogout,
  IconMenu2,
  IconServer,
  IconSettings,
  IconX,
} from "@tabler/icons-react"
import { AnimatePresence, motion } from "motion/react"

import { clearStoredApiKey } from "@/lib/api"
import { cn } from "@/lib/utils"

const links = [
  { label: "Nodes", href: "/dashboard", icon: IconServer },
  { label: "History", href: "/history", icon: IconHistory },
  { label: "Settings", href: "/settings", icon: IconSettings },
] as const

const COLLAPSED = 76
const EXPANDED = 216

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="flex min-h-svh w-full bg-background text-foreground">
      <aside className="sticky top-0 z-30 hidden h-svh shrink-0 p-3 md:block">
        <motion.div
          className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-900"
          initial={false}
          animate={{ width: open ? EXPANDED : COLLAPSED }}
          transition={{ type: "spring", stiffness: 340, damping: 34 }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <div className="flex items-center px-3 pt-3 pb-2">
            <BrandMark expanded={open} />
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-2">
            {links.map((link) => (
              <RailItem key={link.label} {...link} expanded={open} />
            ))}
          </nav>

          <div className="border-t border-white/5 px-2 pt-2 pb-3">
            <button
              type="button"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => {
                clearStoredApiKey()
                window.location.href = "/"
              }}
              className={cn(
                "flex h-11 w-full items-center rounded-2xl transition-colors",
                open ? "gap-3 px-3" : "justify-center",
                "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
              )}
            >
              <IconLogout className="size-[18px] shrink-0" stroke={1.75} />
              <span
                className={cn(
                  "truncate text-sm font-medium transition-opacity duration-150",
                  open ? "opacity-100" : "w-0 opacity-0"
                )}
              >
                Sign out
              </span>
            </button>
          </div>
        </motion.div>
      </aside>

      <div className="fixed top-3 left-3 z-40 md:hidden">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900"
        >
          <IconMenu2 className="size-5" />
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="fixed inset-0 z-50 bg-background p-6 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="mb-8 flex items-center justify-between">
              <span className="text-sm font-medium">Luraph</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="flex size-10 items-center justify-center rounded-2xl border border-white/10"
              >
                <IconX className="size-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <MobileItem
                  key={link.label}
                  {...link}
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
              <div className="my-3 border-t border-white/10" />
              <button
                type="button"
                onClick={() => {
                  clearStoredApiKey()
                  setMobileOpen(false)
                  window.location.href = "/"
                }}
                className="flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5"
              >
                <IconLogout className="size-[18px] shrink-0" stroke={1.75} />
                Sign out
              </button>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main className="min-w-0 flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}

function BrandMark({ expanded }: { expanded: boolean }) {
  return (
    <Link
      href="/dashboard"
      aria-label="Luraph home"
      className={cn(
        "flex h-11 w-full items-center rounded-2xl",
        expanded ? "gap-3 px-1.5" : "justify-center"
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-950">
        L
      </span>
      <span
        className={cn(
          "truncate text-sm font-medium tracking-tight transition-opacity duration-150",
          expanded ? "opacity-100" : "w-0 opacity-0"
        )}
      >
        Luraph
      </span>
    </Link>
  )
}

function useActiveHref(href: string) {
  const pathname = usePathname()
  if (href === "/") return false
  return pathname === href
}

function RailItem({
  label,
  href,
  icon: Icon,
  expanded,
}: {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string; stroke?: number }>
  expanded: boolean
}) {
  const active = useActiveHref(href)

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center rounded-2xl transition-colors",
        expanded ? "gap-3 px-3" : "justify-center",
        active
          ? "bg-zinc-100 text-zinc-950"
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
      )}
    >
      <Icon className="size-[18px] shrink-0" stroke={1.75} />
      <span
        className={cn(
          "truncate text-sm font-medium transition-opacity duration-150",
          expanded ? "opacity-100" : "w-0 opacity-0"
        )}
      >
        {label}
      </span>
    </Link>
  )
}

function MobileItem({
  label,
  href,
  icon: Icon,
  onNavigate,
}: {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string; stroke?: number }>
  onNavigate: () => void
}) {
  const active = useActiveHref(href)

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors",
        active
          ? "bg-zinc-100 text-zinc-950"
          : "text-zinc-300 hover:bg-white/5"
      )}
    >
      <Icon className="size-[18px] shrink-0" stroke={1.75} />
      {label}
    </Link>
  )
}
