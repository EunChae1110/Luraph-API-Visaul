"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BookmarkIcon,
  FileIcon,
  FolderIcon,
  PlayIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { OptionControl } from "@/components/console/option-control"
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
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ApiError, createJob } from "@/lib/api"
import { ensureFollow } from "@/lib/job-follow"
import type { HistoryJob } from "@/lib/jobs"
import {
  buildDefaultOptions,
  dependenciesMet,
  mergeOptionsWithNode,
  type LuraphNode,
  type LuraphOptionList,
  type LuraphOptionValue,
} from "@/lib/luraph-types"
import {
  deleteNodeConfig,
  getDefaultNodeConfig,
  getDefaultNodeConfigId,
  listNodeConfigs,
  saveNodeConfig,
  setDefaultNodeConfig,
  type NodeConfig,
} from "@/lib/node-configs"

const DEFAULTS_VALUE = "__defaults__"
const SCRIPT_EXT = /\.(lua|luau|txt)$/i

type PickedFile = {
  id: string
  file: File
  relativePath: string
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
    buildDefaultOptions(node)
  )
  const [configs, setConfigs] = React.useState<NodeConfig[]>([])
  const [selectedConfigId, setSelectedConfigId] = React.useState(DEFAULTS_VALUE)
  const [configName, setConfigName] = React.useState("")
  const [makeDefault, setMakeDefault] = React.useState(false)
  const [defaultConfigId, setDefaultConfigId] = React.useState<string | null>(
    null
  )
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  function refreshConfigs() {
    setConfigs(listNodeConfigs(nodeId))
    setDefaultConfigId(getDefaultNodeConfigId(nodeId))
  }

  function applyConfig(config: NodeConfig | null) {
    const currentDefault = getDefaultNodeConfigId(nodeId)
    setDefaultConfigId(currentDefault)
    if (!config) {
      setSelectedConfigId(DEFAULTS_VALUE)
      setConfigName("")
      setMakeDefault(false)
      setOptions(buildDefaultOptions(node))
      setUseTokens(false)
      setEnforceSettings(true)
      return
    }
    setSelectedConfigId(config.id)
    setConfigName(config.name)
    setMakeDefault(currentDefault === config.id)
    setOptions(mergeOptionsWithNode(node, config.options))
    setUseTokens(config.useTokens)
    setEnforceSettings(config.enforceSettings)
  }

  React.useEffect(() => {
    if (!open) return
    const saved = listNodeConfigs(nodeId)
    setConfigs(saved)
    setPicked([])
    setError(null)
    setPending(false)
    if (filesInputRef.current) filesInputRef.current.value = ""
    if (folderInputRef.current) folderInputRef.current.value = ""

    const fallback = getDefaultNodeConfig(nodeId)
    applyConfig(fallback)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens for this node
  }, [open, node, nodeId])

  function setOption(id: string, value: LuraphOptionValue) {
    setOptions((prev) => ({ ...prev, [id]: value }))
  }

  function onSelectConfig(id: string | null) {
    if (!id || id === DEFAULTS_VALUE) {
      applyConfig(null)
      return
    }
    const config = configs.find((item) => item.id === id) ?? null
    applyConfig(config)
  }

  function onSaveConfig() {
    try {
      const saved = saveNodeConfig({
        id:
          selectedConfigId !== DEFAULTS_VALUE &&
          configs.some((item) => item.id === selectedConfigId)
            ? selectedConfigId
            : undefined,
        name: configName,
        nodeId,
        options,
        useTokens,
        enforceSettings,
        makeDefault,
      })
      refreshConfigs()
      setSelectedConfigId(saved.id)
      setConfigName(saved.name)
      toast.success(`Saved configuration “${saved.name}”`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save configuration."
      setError(message)
      toast.error(message)
    }
  }

  function onSaveConfigAsNew() {
    try {
      const saved = saveNodeConfig({
        name: configName,
        nodeId,
        options,
        useTokens,
        enforceSettings,
        makeDefault,
      })
      refreshConfigs()
      setSelectedConfigId(saved.id)
      setConfigName(saved.name)
      toast.success(`Created configuration “${saved.name}”`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save configuration."
      setError(message)
      toast.error(message)
    }
  }

  function onDeleteConfig() {
    if (selectedConfigId === DEFAULTS_VALUE) return
    const current = configs.find((item) => item.id === selectedConfigId)
    deleteNodeConfig(selectedConfigId)
    refreshConfigs()
    applyConfig(getDefaultNodeConfig(nodeId))
    toast.success(
      current ? `Deleted “${current.name}”` : "Deleted configuration"
    )
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
      const batchId =
        picked.length > 1 ? crypto.randomUUID() : undefined
      for (const item of picked) {
        const name = (item.relativePath || item.file.name)
          .replaceAll("\\", "/")
          .slice(0, 255)
        const script = await item.file.text()
        const job = await createJob({
          node: nodeId,
          fileName: name,
          script,
          options,
          useTokens,
          enforceSettings,
          batchId,
        })
        created.push(job)
        // Kick off status poll immediately (History page will also pick these up)
        void ensureFollow(job.id)
      }

      toast.success(
        created.length === 1
          ? `Queued ${created[0].fileName} — auto-following status…`
          : `Queued batch of ${created.length} jobs — auto-following status…`
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
  const selectedConfigLabel =
    selectedConfigId === DEFAULTS_VALUE
      ? "Node defaults"
      : (configs.find((config) => config.id === selectedConfigId)?.name ??
        "Node defaults")

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
              You selected <strong className="text-primary">{nodeId}</strong> to create new obfuscated code.
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
                  <h3 className="text-sm font-medium">Options</h3>
                  <Badge variant="outline" className="rounded-full">
                    {optionEntries.length}
                  </Badge>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
                  <div className="flex flex-col gap-2">
                    <FieldLabel htmlFor="node-config">Configuration</FieldLabel>
                    <Select
                      value={selectedConfigId}
                      onValueChange={onSelectConfig}
                    >
                        <SelectTrigger
                          id="node-config"
                          className="w-full min-w-0 rounded-full"
                        >
                          <span className="flex flex-1 truncate text-left">
                            {selectedConfigLabel}
                            {selectedConfigId !== DEFAULTS_VALUE &&
                            defaultConfigId === selectedConfigId
                              ? " · default"
                              : ""}
                          </span>
                        </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value={DEFAULTS_VALUE}>
                            Node defaults
                          </SelectItem>
                          {configs.map((config) => (
                            <SelectItem key={config.id} value={config.id}>
                              {config.name}
                              {defaultConfigId === config.id
                                ? " · default"
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Save this node’s option values and reuse them on the next
                      job.                       Manage all presets from{" "}
                      <Link
                        href="/config"
                        className="text-foreground underline underline-offset-2"
                      >
                        Config
                      </Link>
                      . Defaults apply automatically when you reopen this
                      dialog.
                    </FieldDescription>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={configName}
                      onChange={(e) => setConfigName(e.target.value)}
                      placeholder="Configuration name"
                      maxLength={64}
                      className="font-mono text-sm"
                    />
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="rounded-full"
                        onClick={onSaveConfig}
                      >
                        <SaveIcon data-icon="inline-start" />
                        {selectedConfigId === DEFAULTS_VALUE
                          ? "Save"
                          : "Update"}
                      </Button>
                      {selectedConfigId !== DEFAULTS_VALUE ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="rounded-full"
                          onClick={onSaveConfigAsNew}
                        >
                          <BookmarkIcon data-icon="inline-start" />
                          Save as new
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-full"
                        disabled={selectedConfigId === DEFAULTS_VALUE}
                        onClick={onDeleteConfig}
                      >
                        <Trash2Icon data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={makeDefault}
                      onCheckedChange={(checked) => {
                        const next = checked === true
                        setMakeDefault(next)
                        if (selectedConfigId !== DEFAULTS_VALUE) {
                          setDefaultNodeConfig(
                            nodeId,
                            next ? selectedConfigId : null
                          )
                          setDefaultConfigId(next ? selectedConfigId : null)
                        }
                      }}
                      disabled={selectedConfigId === DEFAULTS_VALUE}
                    />
                    Use as default for {nodeId}
                  </label>
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
                  ? `Create batch of ${picked.length} on ${nodeId}`
                  : `Create job on ${nodeId}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
