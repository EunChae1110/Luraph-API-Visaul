"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  BookmarkPlusIcon,
  CopyIcon,
  Loader2Icon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { ConsoleShell } from "@/components/console/console-shell"
import { OptionControl } from "@/components/console/option-control"
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
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ApiError, fetchNodes, getStoredApiKey } from "@/lib/api"
import {
  buildDefaultOptions,
  dependenciesMet,
  mergeOptionsWithNode,
  type LuraphNode,
  type LuraphOptionList,
  type LuraphOptionValue,
  type NodesResponse,
} from "@/lib/luraph-types"
import {
  NODE_CONFIGS_CHANGED,
  deleteNodeConfig,
  duplicateNodeConfig,
  getDefaultByNode,
  listNodeConfigs,
  saveNodeConfig,
  type NodeConfig,
} from "@/lib/node-configs"
import { cn } from "@/lib/utils"

const EMPTY_NODES: Record<string, LuraphNode> = {}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

type Draft = {
  id: string
  name: string
  nodeId: string
  options: LuraphOptionList
  useTokens: boolean
  enforceSettings: boolean
  makeDefault: boolean
}

function toDraft(
  config: NodeConfig,
  node: LuraphNode | undefined,
  isDefault: boolean
): Draft {
  return {
    id: config.id,
    name: config.name,
    nodeId: config.nodeId,
    options: node
      ? mergeOptionsWithNode(node, config.options)
      : { ...config.options },
    useTokens: config.useTokens,
    enforceSettings: config.enforceSettings,
    makeDefault: isDefault,
  }
}

export function ConfigConsole() {
  const router = useRouter()
  const [nodesData, setNodesData] = React.useState<NodesResponse | null>(null)
  const [configs, setConfigs] = React.useState<NodeConfig[]>([])
  const [defaults, setDefaults] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [nodeFilter, setNodeFilter] = React.useState("all")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createNodeId, setCreateNodeId] = React.useState("")
  const [createName, setCreateName] = React.useState("")
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  const refreshLocal = React.useCallback(() => {
    setConfigs(listNodeConfigs())
    setDefaults(getDefaultByNode())
  }, [])

  const load = React.useCallback(async () => {
    if (!getStoredApiKey()) {
      router.replace("/")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const nodes = await fetchNodes()
      setNodesData(nodes)
      refreshLocal()
    } catch (err) {
      refreshLocal()
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to load nodes. Saved configs are still available."
      setError(message)
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/")
      }
    } finally {
      setLoading(false)
    }
  }, [refreshLocal, router])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    window.addEventListener(NODE_CONFIGS_CHANGED, refreshLocal)
    return () => window.removeEventListener(NODE_CONFIGS_CHANGED, refreshLocal)
  }, [refreshLocal])

  const nodes = nodesData?.nodes ?? EMPTY_NODES
  const nodeIds = React.useMemo(() => {
    const ids = new Set([
      ...Object.keys(nodes),
      ...configs.map((config) => config.nodeId),
    ])
    return [...ids].sort()
  }, [nodes, configs])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return configs.filter((config) => {
      if (nodeFilter !== "all" && config.nodeId !== nodeFilter) return false
      if (!q) return true
      return (
        config.name.toLowerCase().includes(q) ||
        config.nodeId.toLowerCase().includes(q)
      )
    })
  }, [configs, nodeFilter, query])

  const grouped = React.useMemo(() => {
    const map = new Map<string, NodeConfig[]>()
    for (const config of filtered) {
      const list = map.get(config.nodeId) ?? []
      list.push(config)
      map.set(config.nodeId, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  React.useEffect(() => {
    if (!selectedId) {
      setDraft(null)
      return
    }
    const config = configs.find((item) => item.id === selectedId)
    if (!config) {
      setSelectedId(null)
      setDraft(null)
      return
    }
    setDraft((prev) => {
      if (prev?.id === selectedId) return prev
      return toDraft(
        config,
        nodes[config.nodeId],
        defaults[config.nodeId] === config.id
      )
    })
  }, [selectedId, configs, defaults, nodes])

  const selectedNode = draft ? nodes[draft.nodeId] : undefined

  function setOption(id: string, value: LuraphOptionValue) {
    setDraft((prev) =>
      prev ? { ...prev, options: { ...prev.options, [id]: value } } : prev
    )
  }

  function onSave() {
    if (!draft) return
    setSaving(true)
    try {
      const saved = saveNodeConfig({
        id: draft.id,
        name: draft.name,
        nodeId: draft.nodeId,
        options: draft.options,
        useTokens: draft.useTokens,
        enforceSettings: draft.enforceSettings,
        makeDefault: draft.makeDefault,
      })
      refreshLocal()
      setSelectedId(saved.id)
      setDraft(
        toDraft(
          saved,
          nodes[saved.nodeId],
          getDefaultByNode()[saved.nodeId] === saved.id
        )
      )
      toast.success(`Saved “${saved.name}”`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save configuration."
      )
    } finally {
      setSaving(false)
    }
  }

  function onDuplicate() {
    if (!draft) return
    try {
      const copy = duplicateNodeConfig(draft.id)
      refreshLocal()
      setSelectedId(copy.id)
      toast.success(`Duplicated as “${copy.name}”`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not duplicate configuration."
      )
    }
  }

  function onDelete() {
    if (!draft) return
    const name = draft.name
    deleteNodeConfig(draft.id)
    refreshLocal()
    setSelectedId(null)
    setDeleteOpen(false)
    toast.success(`Deleted “${name}”`)
  }

  function onCreate() {
    const nodeId = createNodeId.trim()
    if (!nodeId) {
      toast.error("Select a node.")
      return
    }
    const node = nodes[nodeId]
    try {
      const saved = saveNodeConfig({
        name: createName,
        nodeId,
        options: node ? buildDefaultOptions(node) : {},
        useTokens: false,
        enforceSettings: true,
        makeDefault: listNodeConfigs(nodeId).length === 0,
      })
      refreshLocal()
      setSelectedId(saved.id)
      setCreateOpen(false)
      setCreateName("")
      toast.success(`Created “${saved.name}”`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create configuration."
      )
    }
  }

  return (
    <ConsoleShell>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 items-center justify-center rounded-2xl border border-border bg-secondary/40">
              <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Configurations
              </h1>
              <p className="text-sm text-muted-foreground">
                Named option presets per node. Used when creating jobs.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="rounded-full"
            onClick={() => {
              setCreateNodeId(
                nodeFilter !== "all"
                  ? nodeFilter
                  : (nodesData?.recommendedId ?? nodeIds[0] ?? "")
              )
              setCreateName("")
              setCreateOpen(true)
            }}
          >
            <PlusIcon data-icon="inline-start" />
            New configuration
          </Button>
        </section>

        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or node…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <FilterChip
              active={nodeFilter === "all"}
              onClick={() => setNodeFilter("all")}
            >
              All
            </FilterChip>
            {nodeIds.map((id) => (
              <FilterChip
                key={id}
                active={nodeFilter === id}
                onClick={() => setNodeFilter(id)}
              >
                {id}
              </FilterChip>
            ))}
          </div>
        </section>

        <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(260px,0.9fr)_1.4fr]">
          <div className="rounded-xl border border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium">Presets</h2>
              <Badge variant="outline" className="rounded-full">
                {filtered.length}
              </Badge>
            </div>
            {loading ? (
              <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {configs.length === 0
                  ? "No configurations yet. Create one to reuse node options."
                  : "No presets match this filter."}
              </div>
            ) : (
              <ScrollArea className="h-[min(68vh,640px)]">
                <div className="flex flex-col p-2">
                  {grouped.map(([nodeId, items]) => (
                    <div key={nodeId} className="mb-2">
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {nodeId}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {items.length}
                        </span>
                      </div>
                      {items.map((config) => {
                        const active = config.id === selectedId
                        const isDefault = defaults[config.nodeId] === config.id
                        return (
                          <button
                            key={config.id}
                            type="button"
                            onClick={() => setSelectedId(config.id)}
                            className={cn(
                              "mb-1 flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-colors",
                              active
                                ? "bg-secondary/70"
                                : "hover:bg-secondary/40"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium">
                                {config.name}
                              </span>
                              {isDefault ? (
                                <Badge className="rounded-full text-[10px]">
                                  default
                                </Badge>
                              ) : null}
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {formatTime(config.updatedAt)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="rounded-xl border border-border">
            {!draft ? (
              <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <BookmarkPlusIcon className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Select a configuration</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Edit option values, set a per-node default, or create a new
                  preset.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-medium">{draft.name}</h2>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {draft.nodeId}
                      {selectedNode?.version
                        ? ` · v${selectedNode.version}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-full"
                      onClick={onDuplicate}
                    >
                      <CopyIcon data-icon="inline-start" />
                      Duplicate
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-full"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2Icon data-icon="inline-start" />
                      Delete
                    </Button>
                    <Button
                      type="button"
                      className="rounded-full"
                      disabled={saving}
                      onClick={onSave}
                    >
                      <SaveIcon data-icon="inline-start" />
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[min(68vh,640px)]">
                  <div className="flex flex-col gap-5 p-4">
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="config-name">Name</FieldLabel>
                        <Input
                          id="config-name"
                          value={draft.name}
                          maxLength={64}
                          onChange={(e) =>
                            setDraft((prev) =>
                              prev ? { ...prev, name: e.target.value } : prev
                            )
                          }
                          className="font-mono text-sm"
                        />
                      </Field>
                    </FieldGroup>

                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={draft.makeDefault}
                        onCheckedChange={(checked) =>
                          setDraft((prev) =>
                            prev
                              ? { ...prev, makeDefault: checked === true }
                              : prev
                          )
                        }
                      />
                      <StarIcon className="size-3.5 text-muted-foreground" />
                      Default for {draft.nodeId}
                    </label>
                    <FieldDescription>
                      The create-job dialog applies this preset automatically.
                    </FieldDescription>

                    <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span>
                          <span className="font-medium">useTokens</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Charge tokens instead of subscription quota
                          </span>
                        </span>
                        <Switch
                          checked={draft.useTokens}
                          onCheckedChange={(checked) =>
                            setDraft((prev) =>
                              prev ? { ...prev, useTokens: checked } : prev
                            )
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span>
                          <span className="font-medium">enforceSettings</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Require every option the node declares
                          </span>
                        </span>
                        <Switch
                          checked={draft.enforceSettings}
                          onCheckedChange={(checked) =>
                            setDraft((prev) =>
                              prev
                                ? { ...prev, enforceSettings: checked }
                                : prev
                            )
                          }
                        />
                      </label>
                    </div>

                    <div>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-medium">Options</h3>
                        <Badge variant="outline" className="rounded-full">
                          {selectedNode
                            ? Object.keys(selectedNode.options).length
                            : Object.keys(draft.options).length}
                        </Badge>
                      </div>

                      {!selectedNode ? (
                        <div className="rounded-xl border border-border px-3 py-3 text-sm text-muted-foreground">
                          This node is not in the current Luraph node list.
                          Values are kept as stored.
                          <dl className="mt-3 space-y-1.5 font-mono text-[11px]">
                            {Object.entries(draft.options).map(
                              ([id, value]) => (
                                <div
                                  key={id}
                                  className="flex justify-between gap-3"
                                >
                                  <dt className="truncate text-muted-foreground">
                                    {id}
                                  </dt>
                                  <dd>{String(value)}</dd>
                                </div>
                              )
                            )}
                          </dl>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
                          {Object.entries(selectedNode.options).map(
                            ([optionId, option]) => {
                              const enabled = dependenciesMet(
                                option,
                                draft.options
                              )
                              return (
                                <OptionControl
                                  key={optionId}
                                  optionId={optionId}
                                  option={option}
                                  value={draft.options[optionId]}
                                  disabled={!enabled}
                                  onChange={(value) =>
                                    setOption(optionId, value)
                                  }
                                />
                              )
                            }
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>New configuration</DialogTitle>
            <DialogDescription>
              Saved on this device and scoped to a single node.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel>Node</FieldLabel>
              <Select
                value={createNodeId}
                onValueChange={(value) => {
                  if (value) setCreateNodeId(value)
                }}
              >
                <SelectTrigger className="w-full min-w-0 rounded-full">
                  <SelectValue placeholder="Select a node" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {nodeIds.map((id) => (
                      <SelectItem key={id} value={id}>
                        {id}
                        {id === nodesData?.recommendedId
                          ? " · recommended"
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="new-config-name">Name</FieldLabel>
              <Input
                id="new-config-name"
                value={createName}
                maxLength={64}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Premium Lua"
                className="font-mono text-sm"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full"
              onClick={onCreate}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete configuration</DialogTitle>
            <DialogDescription>
              {draft
                ? `“${draft.name}” will be removed from this device.`
                : "This configuration will be removed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-full"
              onClick={onDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConsoleShell>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-foreground/20 bg-secondary text-foreground"
          : "border-border text-muted-foreground hover:bg-secondary/50"
      )}
    >
      {children}
    </button>
  )
}