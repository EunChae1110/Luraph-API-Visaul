import type { HistoryJob } from "@/lib/jobs"
import type { LuraphOptionList, NodesResponse } from "@/lib/luraph-types"

export const API_KEY_STORAGE = "luraph-api-key"
export const API_BASE_STORAGE = "luraph-api-base"

const DEFAULT_API_BASE = "http://127.0.0.1:8787"

export function getApiBase() {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(API_BASE_STORAGE)?.trim()
    if (stored) return stored.replace(/\/$/, "")
  }
  return (
    process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || DEFAULT_API_BASE
  )
}

export function getStoredApiBase(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || DEFAULT_API_BASE
  }
  return (
    window.localStorage.getItem(API_BASE_STORAGE)?.trim().replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ||
    DEFAULT_API_BASE
  )
}

export function setStoredApiBase(base: string) {
  const cleaned = base.trim().replace(/\/$/, "")
  if (!cleaned) {
    window.localStorage.removeItem(API_BASE_STORAGE)
    return getApiBase()
  }
  window.localStorage.setItem(API_BASE_STORAGE, cleaned)
  return cleaned
}

export function getStoredApiKey(): string | null {
  if (typeof window === "undefined") return null
  const key = window.localStorage.getItem(API_KEY_STORAGE)?.trim()
  return key || null
}

export function setStoredApiKey(key: string) {
  window.localStorage.setItem(API_KEY_STORAGE, key.trim())
}

export function clearStoredApiKey() {
  window.localStorage.removeItem(API_KEY_STORAGE)
}

export function maskApiKey(key: string | null) {
  if (!key) return "—"
  if (key.length <= 10) return "••••••••"
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

type RequestOptions = {
  method?: string
  body?: unknown
  apiKey?: string | null
  raw?: boolean
}

async function request<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const apiKey = options.apiKey ?? getStoredApiKey()
  if (!apiKey) {
    throw new ApiError(401, "Sign in with your Luraph API key first.")
  }

  const headers: Record<string, string> = {
    "Luraph-API-Key": apiKey,
  }
  if (options.body !== undefined && !options.raw) {
    headers["Content-Type"] = "application/json"
  }

  const res = await fetch(`${getApiBase()}${path}`, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body:
      options.body === undefined
        ? undefined
        : options.raw
          ? (options.body as BodyInit)
          : JSON.stringify(options.body),
  })

  if (options.raw) {
    if (!res.ok) {
      const message = await readError(res)
      throw new ApiError(res.status, message)
    }
    return res as T
  }

  const text = await res.text()
  const data = text ? safeJson(text) : null

  if (!res.ok) {
    throw new ApiError(res.status, messageFromBody(data, res.status))
  }

  return data as T
}

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function messageFromBody(data: unknown, status: number) {
  if (data && typeof data === "object") {
    const obj = data as { message?: string; errors?: Array<{ message?: string }> }
    if (obj.message) return obj.message
    if (obj.errors?.length) {
      return obj.errors.map((e) => e.message).filter(Boolean).join(" | ")
    }
  }
  return `Request failed (${status})`
}

async function readError(res: Response) {
  const text = await res.text()
  if (!text) return `Request failed (${res.status})`
  return messageFromBody(safeJson(text), res.status)
}

export async function verifyApiKey(apiKey: string) {
  await request("/api/v1/nodes", { apiKey })
}

export async function fetchNodes() {
  return request<NodesResponse>("/api/v1/nodes")
}

export async function fetchJobs() {
  const data = await request<{ jobs: HistoryJob[] }>("/api/v1/jobs")
  return data.jobs ?? []
}

export async function createJob(input: {
  node: string
  fileName: string
  script: string
  options: LuraphOptionList
  useTokens?: boolean
  enforceSettings?: boolean
}) {
  return request<HistoryJob>("/api/v1/jobs", {
    method: "POST",
    body: {
      node: input.node,
      fileName: input.fileName,
      script: input.script,
      options: input.options,
      useTokens: input.useTokens ?? false,
      enforceSettings: input.enforceSettings ?? true,
    },
  })
}

export async function pollJobStatus(jobId: string) {
  return request<HistoryJob>(`/api/v1/jobs/${encodeURIComponent(jobId)}/status`, {
    method: "POST",
  })
}

export async function downloadJob(jobId: string) {
  const res = await request<Response>(
    `/api/v1/jobs/${encodeURIComponent(jobId)}/download`,
    { raw: true }
  )
  const blob = await res.blob()
  const disposition = res.headers.get("content-disposition") || ""
  const match = /filename\*?=(?:UTF-8''|")?([^\";]+)"?/i.exec(disposition)
  const fileName = match?.[1]
    ? decodeURIComponent(match[1])
    : `${jobId}-obfuscated.lua`

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return fileName
}
