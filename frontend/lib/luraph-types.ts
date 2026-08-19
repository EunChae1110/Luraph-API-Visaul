/** Shapes aligned with Luraph getNodes / GET /obfuscate/nodes */

export type LuraphOptionTier =
  | "CUSTOMER_ONLY"
  | "PREMIUM_ONLY"
  | "ADMIN_ONLY"

export type LuraphOptionType = "CHECKBOX" | "DROPDOWN" | "TEXT"

export type LuraphOptionValue = string | boolean

export type LuraphOptionDependencies = Record<
  string,
  readonly LuraphOptionValue[]
>

export type LuraphOptionInfo = {
  name: string
  description: string
  tier: LuraphOptionTier
  type: LuraphOptionType
  choices: string[]
  required: boolean
  dependencies?: LuraphOptionDependencies
}

export type LuraphNode = {
  cpuUsage: number
  version?: string
  options: Record<string, LuraphOptionInfo>
}

export type NodesResponse = {
  recommendedId: string | null
  nodes: Record<string, LuraphNode>
}

export type LuraphOptionList = Record<string, LuraphOptionValue>

export function defaultOptionValue(option: LuraphOptionInfo): LuraphOptionValue {
  if (option.type === "CHECKBOX") return false
  if (option.type === "DROPDOWN") return option.choices[0] ?? ""
  return ""
}

export function buildDefaultOptions(node: LuraphNode): LuraphOptionList {
  const next: LuraphOptionList = {}
  for (const [id, option] of Object.entries(node.options)) {
    next[id] = defaultOptionValue(option)
  }
  return next
}

export function mergeOptionsWithNode(
  node: LuraphNode,
  saved: LuraphOptionList
): LuraphOptionList {
  const next = buildDefaultOptions(node)
  for (const id of Object.keys(next)) {
    const value = saved[id]
    if (value === undefined) continue
    const option = node.options[id]
    if (option.type === "CHECKBOX") {
      next[id] = Boolean(value)
    } else if (option.type === "DROPDOWN") {
      const asString = String(value)
      next[id] = option.choices.includes(asString) ? asString : next[id]
    } else {
      next[id] = String(value)
    }
  }
  return next
}

export function dependenciesMet(
  option: LuraphOptionInfo,
  values: LuraphOptionList
): boolean {
  if (!option.dependencies) return true
  return Object.entries(option.dependencies).every(([key, allowed]) => {
    const current = values[key]
    return allowed.some((v) => v === current)
  })
}

export function optionStats(node: LuraphNode) {
  const entries = Object.values(node.options)
  return {
    total: entries.length,
    required: entries.filter((o) => o.required).length,
    premium: entries.filter((o) => o.tier === "PREMIUM_ONLY").length,
    checkboxes: entries.filter((o) => o.type === "CHECKBOX").length,
    dropdowns: entries.filter((o) => o.type === "DROPDOWN").length,
    texts: entries.filter((o) => o.type === "TEXT").length,
  }
}
