"use client"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  LuraphOptionInfo,
  LuraphOptionValue,
} from "@/lib/luraph-types"
import { cn } from "@/lib/utils"

export function OptionControl({
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
