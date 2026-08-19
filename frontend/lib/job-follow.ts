import { pollJobStatus } from "@/lib/api"
import type { HistoryJob } from "@/lib/jobs"

const following = new Set<string>()


export function isFollowing(jobId: string) {
  return following.has(jobId)
}


export async function ensureFollow(
  jobId: string,
  onUpdate?: (job: HistoryJob) => void
): Promise<HistoryJob | null> {
  if (following.has(jobId)) return null
  following.add(jobId)
  try {
    const job = await pollJobStatus(jobId)
    onUpdate?.(job)
    return job
  } finally {
    following.delete(jobId)
  }
}
