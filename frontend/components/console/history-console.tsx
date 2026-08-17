"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  DownloadIcon,
  FilterIcon,
  HistoryIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  RefreshCwIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ConsoleShell } from "@/components/console/console-shell"
import { HistoryDiagram } from "@/components/console/history-diagram"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ApiError,
  downloadJob,
  fetchJobs,
  getStoredApiKey,
} from "@/lib/api"
import { ensureFollow, isFollowing } from "@/lib/job-follow"
import type { HistoryJob, JobState } from "@/lib/jobs"
import { isInFlight } from "@/lib/jobs"
import { cn } from "@/lib/utils"

const FILTERS: Array<{ id: "all" | JobState; label: string }> = [
  { id: "all", label: "All" },
  { id: "running", label: "Running" },
  { id: "queued", label: "Queued" },
  { id: "done", label: "Done" },
  { id: "failed", label: "Failed" },
]

function stateVariant(state: JobState) {
  if (state === "done") return "secondary" as const
  if (state === "failed") return "destructive" as const
  if (state === "running") return "default" as const
  return "outline" as const
}

function formatTime(iso: string | null) {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function HistoryConsole() {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<"all" | JobState>("all")
  const [detailJob, setDetailJob] = React.useState<HistoryJob | null>(null)
  const [jobs, setJobs] = React.useState<HistoryJob[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const load = React.useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!getStoredApiKey()) {
        router.replace("/")
        return
      }
      if (!opts?.quiet) {
        setLoading(true)
        setError(null)
      }
      try {
        const next = await fetchJobs()
        setJobs(next)
        setDetailJob((prev) =>
          prev ? (next.find((j) => j.id === prev.id) ?? prev) : null
        )
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to load history. Is the backend running?"
        if (!opts?.quiet) setError(message)
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/")
        }
      } finally {
        if (!opts?.quiet) setLoading(false)
      }
    },
    [router]
  )

  const applyJobUpdate = React.useCallback((updated: HistoryJob) => {
    setJobs((prev) => {
      const exists = prev.some((j) => j.id === updated.id)
      return exists
        ? prev.map((j) => (j.id === updated.id ? updated : j))
        : [updated, ...prev]
    })
    setDetailJob((prev) => (prev?.id === updated.id ? updated : prev))
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  // Auto-poll Luraph status for every queued/running job (backs up on success).
  const inflightKey = jobs
    .filter(isInFlight)
    .map((j) => j.id)
    .sort()
    .join(",")

  React.useEffect(() => {
    if (!inflightKey) return

    let cancelled = false
    const ids = inflightKey.split(",").filter(Boolean)

    async function followAll() {
      for (const id of ids) {
        if (cancelled) return
        if (isFollowing(id)) continue
        setBusyId(id)
        try {
          const updated = await ensureFollow(id)
          if (cancelled || !updated) continue
          applyJobUpdate(updated)
          if (updated.state === "done") {
            toast.success(
              updated.localPath
                ? `Finished & backed up ${updated.fileName}`
                : `Finished ${updated.fileName}`
            )
          } else if (updated.state === "failed") {
            toast.error(updated.error || `Failed ${updated.fileName}`)
          }
        } catch (err) {
          if (cancelled) return
          const message =
            err instanceof ApiError ? err.message : "Auto status poll failed"
          toast.error(message)
          await load({ quiet: true })
        } finally {
          if (!cancelled) setBusyId((prev) => (prev === id ? null : prev))
        }
      }
    }

    void followAll()

    // List refresh while waiting (in case another client/process updates DB)
    const interval = window.setInterval(() => {
      void load({ quiet: true })
    }, 4000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [inflightKey, applyJobUpdate, load])

  async function handlePoll(job: HistoryJob) {
    setBusyId(job.id)
    const toastId = toast.loading(`Waiting for ${job.id}…`)
    try {
      const updated = await ensureFollow(job.id)
      if (!updated) {
        toast.message("Already following this job…", { id: toastId })
        return
      }
      applyJobUpdate(updated)
      toast.success(
        updated.state === "done"
          ? updated.localPath
            ? "Finished & backed up"
            : "Job finished"
          : `Job ${updated.state}`,
        { id: toastId }
      )
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to poll job status"
      toast.error(message, { id: toastId })
    } finally {
      setBusyId(null)
    }
  }

  async function handleDownload(job: HistoryJob) {
    setBusyId(job.id)
    try {
      const name = await downloadJob(job.id)
      toast.success(`Downloaded ${name}`)
      await load()
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Download failed"
      toast.error(message)
    } finally {
      setBusyId(null)
    }
  }

  const filtered = jobs.filter((job) => {
    const matchFilter = filter === "all" || job.state === filter
    const q = query.trim().toLowerCase()
    const matchQuery =
      !q ||
      job.id.toLowerCase().includes(q) ||
      job.fileName.toLowerCase().includes(q) ||
      job.nodeId.toLowerCase().includes(q)
    return matchFilter && matchQuery
  })

  const counts = {
    all: jobs.length,
    done: jobs.filter((j) => j.state === "done").length,
    failed: jobs.filter((j) => j.state === "failed").length,
    running: jobs.filter((j) => j.state === "running").length,
    queued: jobs.filter((j) => j.state === "queued").length,
  }

  return (
    <ConsoleShell>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 items-center justify-center rounded-2xl border border-border bg-secondary/40">
                <HistoryIcon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">History</h1>
                <p className="text-sm text-muted-foreground">
                  Auto-polls status, backs up results locally, stores path in
                  SQLite
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {inflightKey ? (
                <Badge variant="outline" className="rounded-full">
                  auto-following…
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-full">
                  live · SQLite
                </Badge>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full"
                onClick={() => void load()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Total" value={String(counts.all)} />
            <MiniStat label="Done" value={String(counts.done)} />
            <MiniStat label="Failed" value={String(counts.failed)} />
            <MiniStat
              label="In flight"
              value={String(counts.running + counts.queued)}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <FilterIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jobId, file, node…"
              className="h-10 rounded-full pl-9 font-mono text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={filter === item.id ? "default" : "ghost"}
                className={cn(
                  "rounded-full",
                  filter !== item.id && "text-muted-foreground"
                )}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </section>

        <HistoryDiagram jobs={filtered} />

        <section className="overflow-hidden rounded-xl border border-border">
          <ScrollArea className="h-[560px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Node</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-32 text-center text-muted-foreground"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Loader2Icon className="size-4 animate-spin" />
                        Loading jobs…
                      </span>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No jobs match this filter
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {job.fileName}
                          </div>
                          <div className="truncate font-mono text-[11px] text-muted-foreground">
                            {job.id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {job.nodeId}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={stateVariant(job.state)}
                          className="rounded-full capitalize"
                        >
                          {job.state}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatTime(job.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <JobRowMenu
                          job={job}
                          busy={busyId === job.id}
                          onSeeDetails={() => setDetailJob(job)}
                          onPoll={() => void handlePoll(job)}
                          onDownload={() => void handleDownload(job)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </section>
      </div>

      <JobDetailsDialog
        job={detailJob}
        open={Boolean(detailJob)}
        busy={detailJob ? busyId === detailJob.id : false}
        onOpenChange={(open) => {
          if (!open) setDetailJob(null)
        }}
        onPoll={(job) => void handlePoll(job)}
        onDownload={(job) => void handleDownload(job)}
      />
    </ConsoleShell>
  )
}

function JobRowMenu({
  job,
  busy,
  onSeeDetails,
  onPoll,
  onDownload,
}: {
  job: HistoryJob
  busy: boolean
  onSeeDetails: () => void
  onPoll: () => void
  onDownload: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label={`Actions for ${job.fileName}`}
            disabled={busy}
          />
        }
      >
        {busy ? (
          <Loader2Icon className="animate-spin" />
        ) : (
          <MoreHorizontalIcon />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onSeeDetails}>
            See details
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={job.state !== "done"}
            onClick={onDownload}
          >
            Download
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={job.state === "done" || job.state === "failed"}
            onClick={onPoll}
          >
            Poll status
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={async () => {
              await navigator.clipboard.writeText(job.id)
              toast.success("jobId copied")
            }}
          >
            Copy jobId
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function JobDetailsDialog({
  job,
  open,
  busy,
  onOpenChange,
  onPoll,
  onDownload,
}: {
  job: HistoryJob | null
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onPoll: (job: HistoryJob) => void
  onDownload: (job: HistoryJob) => void
}) {
  if (!job) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{job.fileName}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {job.id}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          <DetailRow label="node" value={job.nodeId} />
          <DetailRow label="createdAt" value={formatTime(job.createdAt)} />
          <DetailRow label="finishedAt" value={formatTime(job.finishedAt)} />
          <DetailRow
            label="useTokens"
            value={job.useTokens ? "true" : "false"}
          />
          <DetailRow label="result" value={job.resultFileName ?? "—"} />
          <DetailRow label="localPath" value={job.localPath ?? "—"} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">state</span>
            <Badge
              variant={stateVariant(job.state)}
              className="rounded-full capitalize"
            >
              {job.state}
            </Badge>
          </div>
          {job.error ? (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
              {job.error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="secondary"
            className="rounded-full"
            disabled={busy || job.state === "done" || job.state === "failed"}
            onClick={() => onPoll(job)}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Poll status
          </Button>
          <Button
            className="rounded-full"
            disabled={busy || job.state !== "done"}
            onClick={() => onDownload(job)}
          >
            <DownloadIcon data-icon="inline-start" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="max-w-[70%] break-all text-right font-mono text-xs">
        {value}
      </span>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/30 px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm font-medium">{value}</div>
    </div>
  )
}
