"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CpuIcon, ListTreeIcon, Loader2Icon, RefreshCwIcon, SparklesIcon } from "lucide-react"

import { ConsoleShell } from "@/components/console/console-shell"
import { CreateJobDialog } from "@/components/console/create-job-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ApiError, fetchJobs, fetchNodes, getStoredApiKey } from "@/lib/api"
import type { HistoryJob } from "@/lib/jobs"
import {
  optionStats,
  type LuraphNode,
  type LuraphOptionInfo,
  type LuraphOptionTier,
  type NodesResponse,
} from "@/lib/luraph-types"
import { cn } from "@/lib/utils"

function cpuTone(cpu: number) {
  if (cpu < 35) return "text-foreground"
  if (cpu < 70) return "text-muted-foreground"
  return "text-destructive"
}

function tierLabel(tier: LuraphOptionTier) {
  if (tier === "CUSTOMER_ONLY") return "customer"
  if (tier === "PREMIUM_ONLY") return "premium"
  return "admin"
}

export function NodesConsole() {
  const router = useRouter()
  const [data, setData] = React.useState<NodesResponse | null>(null)
  const [recentJobs, setRecentJobs] = React.useState<HistoryJob[]>([])
  const [selectedId, setSelectedId] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!getStoredApiKey()) {
      router.replace("/")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [nodes, jobs] = await Promise.all([fetchNodes(), fetchJobs()])
      setData(nodes)
      setRecentJobs(jobs)
      const first =
        nodes.recommendedId ?? Object.keys(nodes.nodes)[0] ?? ""
      setSelectedId((prev) => (prev && nodes.nodes[prev] ? prev : first))
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to load nodes. Is the backend running?"
      setError(message)
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/")
      }
    } finally {
      setLoading(false)
    }
  }, [router])

  React.useEffect(() => {
    void load()
  }, [load])

  const recommendedId = data?.recommendedId ?? null
  const nodes = data?.nodes ?? {}
  const nodeEntries = Object.entries(nodes)
  const selected: LuraphNode | undefined = nodes[selectedId]
  const selectedOptions = selected ? Object.entries(selected.options) : []
  const stats = selected ? optionStats(selected) : null

  const avgCpu = Math.round(
    nodeEntries.reduce((sum, [, n]) => sum + n.cpuUsage, 0) /
      Math.max(nodeEntries.length, 1)
  )

  return (
    <ConsoleShell>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-3">
            <Stat
              label="Nodes"
              value={loading ? "…" : String(nodeEntries.length)}
              icon={<ListTreeIcon />}
            />
            <Stat
              label="recommendedId"
              value={loading ? "…" : (recommendedId ?? "null")}
              icon={<SparklesIcon />}
            />
            <Stat
              label="Avg cpuUsage"
              value={loading ? "…" : `${avgCpu}%`}
              icon={<CpuIcon />}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 rounded-full"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh dashboard"
          >
            <RefreshCwIcon
              data-icon="inline-start"
              className={cn(loading && "animate-spin")}
            />
            Refresh
          </Button>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Nodes
              </h1>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading nodes…
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {nodeEntries.map(([id, node]) => {
                const active = id === selectedId
                const s = optionStats(node)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedId(id)}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-4 text-left transition-colors",
                      active && "border-primary/50 bg-secondary/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-sm font-medium tracking-tight">
                          {id}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {s.total} options · {s.required} required
                          {node.version ? ` · v${node.version}` : ""}
                        </div>
                      </div>
                      {id === recommendedId ? (
                        <Badge className="rounded-full">recommended</Badge>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between font-mono text-[11px]">
                        <span className="text-muted-foreground">cpuUsage</span>
                        <span className={cpuTone(node.cpuUsage)}>
                          {node.cpuUsage}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/80"
                          style={{
                            width: `${Math.min(node.cpuUsage, 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {s.premium > 0 ? (
                        <Badge variant="outline" className="rounded-full">
                          {s.premium} premium
                        </Badge>
                      ) : null}
                      <Badge variant="secondary" className="rounded-full">
                        {s.dropdowns} dropdown
                      </Badge>
                      <Badge variant="secondary" className="rounded-full">
                        {s.checkboxes} checkbox
                      </Badge>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
          <div className="rounded-xl border border-border" id="settings">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-medium">Node options</h2>
              </div>
              {stats ? (
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="rounded-full">
                    {stats.total} total
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {stats.required} required
                  </Badge>
                </div>
              ) : null}
            </div>

            <ScrollArea className="h-[320px]">
              <ul className="flex flex-col">
                {selectedOptions.map(([optionId, option], index) => (
                  <li key={optionId}>
                    {index > 0 ? <Separator /> : null}
                    <OptionRow optionId={optionId} option={option} />
                  </li>
                ))}
                {!loading && selectedOptions.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Select a node to inspect options
                  </li>
                ) : null}
              </ul>
            </ScrollArea>

            <div className="border-t border-border p-4">
              {selected ? (
                <CreateJobDialog
                  nodeId={selectedId}
                  node={selected}
                  onCreated={() => void load()}
                />
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border" id="jobs">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-medium">Recent history</h2>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full"
                nativeButton={false}
                render={<Link href="/history" />}
              >
                Open
              </Button>
            </div>
            <ScrollArea className="h-[360px]">
              <ul className="flex flex-col">
                {recentJobs.slice(0, 5).map((job, index) => (
                  <li key={job.id}>
                    {index > 0 ? <Separator /> : null}
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm">{job.fileName}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {job.nodeId} · {job.id}
                        </div>
                      </div>
                      <Badge
                        variant={
                          job.state === "done"
                            ? "secondary"
                            : job.state === "failed"
                              ? "destructive"
                              : "outline"
                        }
                        className="rounded-full"
                      >
                        {job.state}
                      </Badge>
                    </div>
                  </li>
                ))}
                {!loading && recentJobs.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No jobs yet
                  </li>
                ) : null}
              </ul>
            </ScrollArea>
          </div>
        </section>
      </div>
    </ConsoleShell>
  )
}

function OptionRow({
  optionId,
  option,
}: {
  optionId: string
  option: LuraphOptionInfo
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">{option.name}</div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {optionId}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <Badge variant="secondary" className="rounded-full">
            {option.type}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {tierLabel(option.tier)}
          </Badge>
          {option.required ? (
            <Badge className="rounded-full">required</Badge>
          ) : null}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {option.description}
      </p>
      {option.type === "DROPDOWN" && option.choices.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {option.choices.map((choice) => (
            <Badge
              key={choice}
              variant="outline"
              className="rounded-full font-mono text-[10px]"
            >
              {choice}
            </Badge>
          ))}
        </div>
      ) : null}
      {option.dependencies ? (
        <div className="font-mono text-[10px] text-muted-foreground">
          dependencies: {JSON.stringify(option.dependencies)}
        </div>
      ) : null}
    </div>
  )
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card/30 px-4 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-muted-foreground [&_svg]:size-3.5">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="truncate font-mono text-sm font-medium tracking-tight">
        {value}
      </div>
    </div>
  )
}
