"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  Loader2Icon,
  ServerIcon,
  SettingsIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ConsoleShell } from "@/components/console/console-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  ApiError,
  clearStoredApiKey,
  getApiBase,
  getStoredApiBase,
  getStoredApiKey,
  maskApiKey,
  setStoredApiBase,
  setStoredApiKey,
  verifyApiKey,
} from "@/lib/api"

type HealthPayload = {
  ok?: boolean
  service?: string
  version?: string
  os?: string
  arch?: string
}

export function SettingsConsole() {
  const router = useRouter()
  const [apiKey, setApiKey] = React.useState("")
  const [apiBase, setApiBase] = React.useState(DEFAULT_BASE_PLACEHOLDER)
  const [visible, setVisible] = React.useState(false)
  const [keyError, setKeyError] = React.useState<string | null>(null)
  const [baseError, setBaseError] = React.useState<string | null>(null)
  const [savingKey, setSavingKey] = React.useState(false)
  const [savingBase, setSavingBase] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [health, setHealth] = React.useState<HealthPayload | null>(null)
  const [connection, setConnection] = React.useState<
    "unknown" | "ok" | "error"
  >("unknown")

  React.useEffect(() => {
    if (!getStoredApiKey()) {
      router.replace("/")
      return
    }
    setApiKey(getStoredApiKey() || "")
    setApiBase(getStoredApiBase())
    void probeHealth()
  }, [router])

  async function probeHealth() {
    try {
      const res = await fetch(`${getApiBase()}/health`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as HealthPayload
      setHealth(data)
      setConnection("ok")
    } catch {
      setHealth(null)
      setConnection("error")
    }
  }

  async function onSaveKey(event: React.FormEvent) {
    event.preventDefault()
    const value = apiKey.trim()
    if (!value) {
      setKeyError("Enter your Luraph API key.")
      return
    }
    if (value.length < 8) {
      setKeyError("That key looks too short.")
      return
    }
    setKeyError(null)
    setSavingKey(true)
    try {
      await verifyApiKey(value)
      setStoredApiKey(value)
      toast.success("API key saved")
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Could not verify key against the backend."
      setKeyError(message)
      toast.error(message)
    } finally {
      setSavingKey(false)
    }
  }

  async function onSaveBase(event: React.FormEvent) {
    event.preventDefault()
    const value = apiBase.trim()
    if (!value) {
      setBaseError("Backend URL is required.")
      return
    }
    setBaseError(null)
    setSavingBase(true)
    try {
      const parsed = new URL(value)
      if (!parsed.protocol.startsWith("http")) {
        setBaseError("URL must start with http:// or https://")
        return
      }
      setStoredApiBase(value)
      setApiBase(getStoredApiBase())
      await probeHealth()
      toast.success("Backend URL saved")
    } catch {
      setBaseError("Enter a valid URL, e.g. http://127.0.0.1:8787")
    } finally {
      setSavingBase(false)
    }
  }

  async function onTestConnection() {
    setTesting(true)
    try {
      await probeHealth()
      const key = getStoredApiKey()
      if (key) await verifyApiKey(key)
      toast.success("Backend and API key look good")
      setConnection("ok")
    } catch (err) {
      setConnection("error")
      const message =
        err instanceof ApiError
          ? err.message
          : "Connection test failed. Is the backend running?"
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  function onSignOut() {
    clearStoredApiKey()
    router.replace("/")
  }

  return (
    <ConsoleShell>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 items-center justify-center rounded-2xl border border-border bg-secondary/40">
              <SettingsIcon className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground">
                  API key, backend URL (default embedded at :8787), and connection
                  checks
                </p>
            </div>
          </div>
          <Badge
            variant={
              connection === "ok"
                ? "secondary"
                : connection === "error"
                  ? "destructive"
                  : "outline"
            }
            className="rounded-full"
          >
            {connection === "ok"
              ? "online"
              : connection === "error"
                ? "offline"
                : "checking…"}
          </Badge>
        </section>

        <section className="rounded-xl border border-border">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <ServerIcon className="size-3.5 text-muted-foreground" />
            <h2 className="text-sm font-medium">Backend</h2>
          </div>
          <form onSubmit={onSaveBase} className="flex flex-col gap-4 p-4">
            <FieldGroup>
              <Field data-invalid={Boolean(baseError) || undefined}>
                <FieldLabel htmlFor="api-base">API base URL</FieldLabel>
                <Input
                  id="api-base"
                  value={apiBase}
                  onChange={(e) => {
                    setApiBase(e.target.value)
                    if (baseError) setBaseError(null)
                  }}
                  className="font-mono text-sm"
                  placeholder="http://127.0.0.1:8787"
                  spellCheck={false}
                  autoComplete="off"
                />
                <FieldDescription>
                  Local Rust proxy. Default is{" "}
                  <code className="text-xs">http://127.0.0.1:8787</code>.
                </FieldDescription>
                {baseError ? <FieldError>{baseError}</FieldError> : null}
              </Field>
            </FieldGroup>

            {health ? (
              <div className="grid gap-2 rounded-xl border border-border bg-card/30 px-3 py-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
                <div>service · {health.service ?? "—"}</div>
                <div>version · {health.version ?? "—"}</div>
                <div>
                  os · {health.os ?? "—"} / {health.arch ?? "—"}
                </div>
                <div>status · {health.ok ? "ok" : "degraded"}</div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                className="rounded-full"
                disabled={savingBase}
              >
                {savingBase ? "Saving…" : "Save URL"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="rounded-full"
                disabled={testing}
                onClick={() => void onTestConnection()}
              >
                {testing ? (
                  <>
                    <Loader2Icon
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                    Testing…
                  </>
                ) : (
                  "Test connection"
                )}
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-border">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <KeyRoundIcon className="size-3.5 text-muted-foreground" />
            <h2 className="text-sm font-medium">Luraph API key</h2>
          </div>
          <form onSubmit={onSaveKey} className="flex flex-col gap-4 p-4">
            <FieldGroup>
              <Field data-invalid={Boolean(keyError) || undefined}>
                <FieldLabel htmlFor="settings-api-key">API key</FieldLabel>
                <InputGroup className="h-11 rounded-xl bg-secondary/80">
                  <InputGroupAddon>
                    <KeyRoundIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="settings-api-key"
                    type={visible ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value)
                      if (keyError) setKeyError(null)
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Paste your API key"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={visible ? "Hide API key" : "Show API key"}
                      onClick={() => setVisible((v) => !v)}
                    >
                      {visible ? <EyeOffIcon /> : <EyeIcon />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  Stored on this device only. Current:{" "}
                  <span className="font-mono">
                    {maskApiKey(getStoredApiKey())}
                  </span>
                </FieldDescription>
                {keyError ? <FieldError>{keyError}</FieldError> : null}
              </Field>
            </FieldGroup>

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                className="rounded-full"
                disabled={savingKey}
              >
                {savingKey ? "Verifying…" : "Save & verify"}
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-border p-4">
          <h2 className="text-sm font-medium">Session</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Clears the API key from this device and returns to sign-in.
          </p>
          <Separator className="my-4" />
          <Button
            type="button"
            variant="destructive"
            className="rounded-full"
            onClick={onSignOut}
          >
            Sign out
          </Button>
        </section>
      </div>
    </ConsoleShell>
  )
}

const DEFAULT_BASE_PLACEHOLDER = "http://127.0.0.1:8787"
