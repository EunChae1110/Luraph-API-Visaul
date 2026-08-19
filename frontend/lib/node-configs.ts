import type { LuraphOptionList } from "@/lib/luraph-types"

export const NODE_CONFIGS_STORAGE = "luraph-node-configs"
export const NODE_CONFIGS_CHANGED = "luraph-node-configs-changed"

export type NodeConfig = {
  id: string
  name: string
  nodeId: string
  options: LuraphOptionList
  useTokens: boolean
  enforceSettings: boolean
  createdAt: string
  updatedAt: string
}

type NodeConfigStore = {
  configs: NodeConfig[]
  defaultByNode: Record<string, string>
}

const EMPTY_STORE: NodeConfigStore = {
  configs: [],
  defaultByNode: {},
}

function canUseStorage() {
  return typeof window !== "undefined"
}

function readStore(): NodeConfigStore {
  if (!canUseStorage()) return EMPTY_STORE
  try {
    const raw = window.localStorage.getItem(NODE_CONFIGS_STORAGE)
    if (!raw) return EMPTY_STORE
    const parsed = JSON.parse(raw) as Partial<NodeConfigStore>
    return {
      configs: Array.isArray(parsed.configs) ? parsed.configs : [],
      defaultByNode:
        parsed.defaultByNode && typeof parsed.defaultByNode === "object"
          ? parsed.defaultByNode
          : {},
    }
  } catch {
    return EMPTY_STORE
  }
}

function writeStore(store: NodeConfigStore) {
  if (!canUseStorage()) return
  window.localStorage.setItem(NODE_CONFIGS_STORAGE, JSON.stringify(store))
  window.dispatchEvent(new Event(NODE_CONFIGS_CHANGED))
}

export function listNodeConfigs(nodeId?: string): NodeConfig[] {
  const configs = readStore().configs
  const filtered = nodeId
    ? configs.filter((config) => config.nodeId === nodeId)
    : configs
  return [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getNodeConfig(id: string): NodeConfig | null {
  return readStore().configs.find((config) => config.id === id) ?? null
}

export function getDefaultNodeConfigId(nodeId: string): string | null {
  const store = readStore()
  const id = store.defaultByNode[nodeId]
  if (!id) return null
  return store.configs.some((config) => config.id === id && config.nodeId === nodeId)
    ? id
    : null
}

export function getDefaultNodeConfig(nodeId: string): NodeConfig | null {
  const id = getDefaultNodeConfigId(nodeId)
  return id ? getNodeConfig(id) : null
}

export function saveNodeConfig(input: {
  id?: string
  name: string
  nodeId: string
  options: LuraphOptionList
  useTokens: boolean
  enforceSettings: boolean
  makeDefault?: boolean
}): NodeConfig {
  const name = input.name.trim()
  if (!name) {
    throw new Error("Configuration name is required.")
  }
  if (name.length > 64) {
    throw new Error("Configuration name must be at most 64 characters.")
  }

  const store = readStore()
  const now = new Date().toISOString()
  const existing = input.id
    ? store.configs.find((config) => config.id === input.id)
    : undefined

  const config: NodeConfig = {
    id: existing?.id ?? crypto.randomUUID(),
    name,
    nodeId: input.nodeId,
    options: { ...input.options },
    useTokens: input.useTokens,
    enforceSettings: input.enforceSettings,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  const configs = existing
    ? store.configs.map((item) => (item.id === config.id ? config : item))
    : [config, ...store.configs]

  const defaultByNode = { ...store.defaultByNode }
  if (input.makeDefault === true) {
    defaultByNode[input.nodeId] = config.id
  } else if (
    input.makeDefault === false &&
    defaultByNode[input.nodeId] === config.id
  ) {
    delete defaultByNode[input.nodeId]
  }

  writeStore({ configs, defaultByNode })
  return config
}

export function deleteNodeConfig(id: string) {
  const store = readStore()
  const target = store.configs.find((config) => config.id === id)
  if (!target) return

  const configs = store.configs.filter((config) => config.id !== id)
  const defaultByNode = { ...store.defaultByNode }
  if (defaultByNode[target.nodeId] === id) {
    delete defaultByNode[target.nodeId]
  }
  writeStore({ configs, defaultByNode })
}

export function duplicateNodeConfig(id: string): NodeConfig {
  const source = getNodeConfig(id)
  if (!source) {
    throw new Error("Configuration not found.")
  }
  const base = source.name.replace(/\s+copy(?:\s+\d+)?$/i, "").trim()
  const siblings = listNodeConfigs(source.nodeId)
  let name = `${base} copy`
  let n = 2
  while (siblings.some((item) => item.name === name) && name.length < 64) {
    name = `${base} copy ${n}`
    n += 1
  }
  return saveNodeConfig({
    name: name.slice(0, 64),
    nodeId: source.nodeId,
    options: source.options,
    useTokens: source.useTokens,
    enforceSettings: source.enforceSettings,
  })
}

export function getDefaultByNode(): Record<string, string> {
  return { ...readStore().defaultByNode }
}

export function setDefaultNodeConfig(nodeId: string, configId: string | null) {
  const store = readStore()
  const defaultByNode = { ...store.defaultByNode }
  if (!configId) {
    delete defaultByNode[nodeId]
  } else {
    const exists = store.configs.some(
      (config) => config.id === configId && config.nodeId === nodeId
    )
    if (!exists) return
    defaultByNode[nodeId] = configId
  }
  writeStore({ configs: store.configs, defaultByNode })
}
