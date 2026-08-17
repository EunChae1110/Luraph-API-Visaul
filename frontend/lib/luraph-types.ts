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
