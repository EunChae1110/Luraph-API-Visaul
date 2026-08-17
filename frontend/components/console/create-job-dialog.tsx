"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { FileIcon, FolderIcon, PlayIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ApiError, createJob } from "@/lib/api"
import { ensureFollow } from "@/lib/job-follow"
import type { HistoryJob } from "@/lib/jobs"
import type {
  LuraphNode,
  LuraphOptionInfo,
  LuraphOptionList,
  LuraphOptionValue,
} from "@/lib/luraph-types"
import { cn } from "@/lib/utils"

const SCRIPT_EXT = /\.(lua|luau|txt)$/i

type PickedFile = {
  id: string
  file: File
  relativePath: string
}

function defaultOptionValue(option: LuraphOptionInfo): LuraphOptionValue {
  if (option.type === "CHECKBOX") return false
  if (option.type === "DROPDOWN") return option.choices[0] ?? ""
  return ""
}

function buildDefaults(node: LuraphNode): LuraphOptionList {
  const next: LuraphOptionList = {}
  for (const [id, option] of Object.entries(node.options)) {
    next[id] = defaultOptionValue(option)
  }
  return next
}

function dependenciesMet(
  option: LuraphOptionInfo,
  values: LuraphOptionList
): boolean {
  if (!option.dependencies) return true
  return Object.entries(option.dependencies).every(([key, allowed]) => {
    const current = values[key]
    return allowed.some((v) => v === current)
  })
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function toPickedFiles(fileList: FileList | null): PickedFile[] {
  if (!fileList) return []
  return Array.from(fileList)
    .filter((file) => SCRIPT_EXT.test(file.name))
    .map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      relativePath:
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name,
    }))
}

export function CreateJobDialog({
  nodeId,
  node,
  onCreated,
}: {
  nodeId: string
  node: LuraphNode
  onCreated?: () => void
}) {
  const router = useRouter()
  const filesInputRef = React.useRef<HTMLInputElement>(null)
  const folderInputRef = React.useRef<HTMLInputElement>(null)

  const [open, setOpen] = React.useState(false)
  const [picked, setPicked] = React.useState<PickedFile[]>([])
  const [useTokens, setUseTokens] = React.useState(false)
  const [enforceSettings, setEnforceSettings] = React.useState(true)
  const [options, setOptions] = React.useState<LuraphOptionList>(() =>
    buildDefaults(node)
  )
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setOptions(buildDefaults(node))
    setPicked([])
    setError(null)
    setPending(false)
    if (filesInputRef.current) filesInputRef.current.value = ""
    if (folderInputRef.current) folderInputRef.current.value = ""
  }, [open, node, nodeId])

  function setOption(id: string, value: LuraphOptionValue) {
    setOptions((prev) => ({ ...prev, [id]: value }))
  }

  function mergePicked(next: PickedFile[]) {
    setPicked((prev) => {
      const map = new Map(prev.map((item) => [item.relativePath, item]))
      for (const item of next) map.set(item.relativePath, item)
      return [...map.values()]
    })
    setError(null)
  }

  function removePicked(id: string) {
    setPicked((prev) => prev.filter((item) => item.id !== id))
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (picked.length === 0) {
      setError("Select at least one .lua / .luau / .txt file or folder.")
      return
    }

    if (enforceSettings) {
      for (const [id, option] of Object.entries(node.options)) {
        if (!option.required) continue
        if (!dependenciesMet(option, options)) continue
        const value = options[id]
        if (option.type === "CHECKBOX") continue
        if (value === "" || value === undefined) {
          setError(`Required option missing: ${id}`)
          return
        }
      }
    }

    setError(null)
    setPending(true)

    try {
      const created: HistoryJob[] = []
      for (const item of picked) {
        const name = item.file.name.slice(0, 255)
        const script = await item.file.text()
        const job = await createJob({
          node: nodeId,
          fileName: name,
          script,
          options,
          useTokens,
          enforceSettings,
        })
        created.push(job)
        // Kick off status poll immediately (History page will also pick these up)
        void ensureFollow(job.id)
      }

      toast.success(
        created.length === 1
          ? `Queued ${created[0].fileName} — auto-following status…`
          : `Queued ${created.length} jobs — auto-following status…`
      )
      onCreated?.()
      setOpen(false)
      router.push("/history")
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to create job. Check the backend and your API key."
      setError(message)
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  const optionEntries = Object.entries(node.options)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button className="relative isolate rounded-full" />}
      >
        Create job on {nodeId}
      </DialogTrigger>

      <DialogContent
        className="flex max-h-[min(90vh,760px)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton
      >
        <form
          onSubmit={onSubmit}
          className="flex max-h-[min(90vh,760px)] min-h-0 flex-1 flex-col"
        >
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
            <DialogTitle>Create job</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              createNewJob · node={nodeId}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            <div className="flex flex-col gap-5">
              <FieldGroup>
                <Field>
                  <FieldLabel>Source</FieldLabel>
                  <FieldDescription>
                    Select files or a folder. Script paste is disabled.
                  </FieldDescription>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-full"
                      onClick={() => filesInputRef.current?.click()}
                    >
                      <FileIcon data-icon="inline-start" />
                      Select files
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-full"
                      onClick={() => folderInputRef.current?.click()}
                    >
                      <FolderIcon data-icon="inline-start" />
                      Select folder
                    </Button>
                  </div>

                  <input
                    ref={filesInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    accept=".lua,.luau,.txt,text/plain"
                    onChange={(e) => {
                      mergePicked(toPickedFiles(e.target.files))
                      e.target.value = ""
                    }}
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    // Chromium folder picker
                    {...({ webkitdirectory: "", directory: "" } as object)}
                    onChange={(e) => {
                      const next = toPickedFiles(e.target.files)
                      if (next.length === 0) {
                        setError("No .lua / .luau / .txt files in that folder.")
                      } else {
                        mergePicked(next)
                      }
                      e.target.value = ""
                    }}
                  />
                </Field>
              </FieldGroup>

              {picked.length > 0 ? (
                <div className="rounded-xl border border-border">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <span className="text-sm font-medium">Selected</span>
                    <Badge variant="outline" className="rounded-full">
                      {picked.length} file{picked.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <ul className="divide-y divide-border">
                    {picked.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs">
                            {item.relativePath}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatBytes(item.file.size)}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="rounded-full"
                          aria-label={`Remove ${item.file.name}`}
                          onClick={() => removePicked(item.id)}
                        >
                          <XIcon />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">options</h3>
                  <Badge variant="outline" className="rounded-full">
                    {optionEntries.length}
                  </Badge>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
                  {optionEntries.map(([optionId, option]) => {
                    const enabled = dependenciesMet(option, options)
                    return (
                      <OptionControl
                        key={optionId}
                        optionId={optionId}
                        option={option}
                        value={options[optionId]}
                        disabled={!enabled}
                        onChange={(value) => setOption(optionId, value)}
                      />
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">useTokens</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Charge tokens instead of subscription quota
                    </span>
                  </span>
                  <Switch checked={useTokens} onCheckedChange={setUseTokens} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">enforceSettings</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Require every option the node declares
                    </span>
                  </span>
                  <Switch
                    checked={enforceSettings}
                    onCheckedChange={setEnforceSettings}
                  />
                </label>
              </div>

              {error ? <FieldError>{error}</FieldError> : null}
            </div>
          </div>

          <DialogFooter className="m-0 shrink-0 rounded-none border-t border-border bg-background px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-full"
              disabled={pending || picked.length === 0}
            >
              <PlayIcon data-icon="inline-start" />
              {pending
                ? "Queuing…"
                : picked.length > 1
                  ? `Create ${picked.length} jobs on ${nodeId}`
                  : `Create job on ${nodeId}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function OptionControl({
  optionId,
  option,
  value,
  disabled,
  onChange,
}: {
  optionId: string
  option: LuraphOptionInfo
  value: LuraphOptionValue | undefined
  disabled?: boolean
  onChange: (value: LuraphOptionValue) => void
}) {
  return (
    <div className={cn(disabled && "pointer-events-none opacity-45")}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-medium">{option.name}</span>
        <Badge variant="secondary" className="rounded-full text-[10px]">
          {option.type}
        </Badge>
        {option.required ? (
          <Badge className="rounded-full text-[10px]">required</Badge>
        ) : null}
        {disabled ? (
          <Badge variant="outline" className="rounded-full text-[10px]">
            locked
          </Badge>
        ) : null}
      </div>
      <p className="mb-2 font-mono text-[11px] text-muted-foreground">
        {optionId}
      </p>

      {option.type === "CHECKBOX" ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked === true)}
            disabled={disabled}
          />
          Enabled
        </label>
      ) : null}

      {option.type === "DROPDOWN" ? (
        <Select
          value={String(value ?? "")}
          onValueChange={(next) => {
            if (next != null) onChange(next)
          }}
          disabled={disabled}
        >
          <SelectTrigger className="w-full min-w-0 rounded-full">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {option.choices.map((choice) => (
                <SelectItem key={choice} value={choice}>
                  {choice}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : null}

      {option.type === "TEXT" ? (
        <Input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="font-mono text-sm"
        />
      ) : null}
    </div>
  )
}
