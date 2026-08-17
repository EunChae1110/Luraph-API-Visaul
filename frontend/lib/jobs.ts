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
}

export function isInFlight(job: HistoryJob) {
  return job.state === "queued" || job.state === "running"
}
