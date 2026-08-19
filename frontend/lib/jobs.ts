/** Shared job history types (SQLite-backed via backend). */

export type JobState = "queued" | "running" | "done" | "failed"

export type HistoryJob = {
  id: string
  fileName: string
  nodeId: string
  state: JobState
  createdAt: string
  finishedAt: string | null
  error: string | null
  resultFileName: string | null
  useTokens: boolean
  /** Local backup path on disk — survives Luraph 24h expiry. */
  localPath: string | null
  /** Set when several files were submitted together. */
  batchId?: string | null
}

export type HistoryGroup = {
  key: string
  batchId: string | null
  jobs: HistoryJob[]
  createdAt: string
  nodeId: string
  state: JobState
}

export function isInFlight(job: HistoryJob) {
  return job.state === "queued" || job.state === "running"
}

export function aggregateJobState(jobs: HistoryJob[]): JobState {
  if (jobs.some((job) => job.state === "failed")) return "failed"
  if (jobs.some((job) => job.state === "running")) return "running"
  if (jobs.some((job) => job.state === "queued")) return "queued"
  return "done"
}

export function groupHistoryJobs(jobs: HistoryJob[]): HistoryGroup[] {
  const byBatch = new Map<string, HistoryJob[]>()
  for (const job of jobs) {
    if (!job.batchId) continue
    const list = byBatch.get(job.batchId) ?? []
    list.push(job)
    byBatch.set(job.batchId, list)
  }

  const seen = new Set<string>()
  const groups: HistoryGroup[] = []

  for (const job of jobs) {
    if (job.batchId) {
      if (seen.has(job.batchId)) continue
      seen.add(job.batchId)
      const members = byBatch.get(job.batchId) ?? [job]
      groups.push({
        key: job.batchId,
        batchId: job.batchId,
        jobs: members,
        createdAt: members[0]?.createdAt ?? job.createdAt,
        nodeId: members[0]?.nodeId ?? job.nodeId,
        state: aggregateJobState(members),
      })
      continue
    }

    groups.push({
      key: job.id,
      batchId: null,
      jobs: [job],
      createdAt: job.createdAt,
      nodeId: job.nodeId,
      state: job.state,
    })
  }

  return groups
}

export function batchLabel(jobs: HistoryJob[]): string {
  const count = jobs.length
  return `${count} file${count === 1 ? "" : "s"}`
}
