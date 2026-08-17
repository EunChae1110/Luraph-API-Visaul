"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { HistoryJob } from "@/lib/jobs"
import { cn } from "@/lib/utils"

const dayConfig = {
  total: { label: "Jobs", color: "oklch(0.88 0 0)" },
} satisfies ChartConfig

const nodeConfig = {
  jobs: { label: "Jobs", color: "oklch(0.88 0 0)" },
} satisfies ChartConfig

function dayKey(iso: string) {
  const d = new Date(iso)
  return d.toISOString().slice(0, 10)
}

function dayLabel(key: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "2-digit",
  }).format(new Date(`${key}T00:00:00Z`))
}

function buildTimeline(jobs: HistoryJob[]) {
  const map = new Map<
    string,
    { day: string; done: number; failed: number; running: number; queued: number }
  >()

  for (const job of jobs) {
    const key = dayKey(job.createdAt)
    const row = map.get(key) ?? {
      day: dayLabel(key),
      done: 0,
      failed: 0,
      running: 0,
      queued: 0,
    }
    row[job.state] += 1
    map.set(key, row)
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => row)
}

function buildByNode(jobs: HistoryJob[]) {
  const map = new Map<string, number>()
  for (const job of jobs) {
    map.set(job.nodeId, (map.get(job.nodeId) ?? 0) + 1)
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([node, jobsCount]) => ({ node, jobs: jobsCount }))
}

type BarShapeProps = {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
}

/** Horizontal capsule bar with a black dot near the trailing (right) end */
function HorizontalCapsuleBar(props: BarShapeProps) {
  const x = props.x ?? 0
  const y = props.y ?? 0
  const width = Math.max(props.width ?? 0, 0)
  const height = Math.max(props.height ?? 0, 0)
  if (width <= 0 || height <= 0) return null

  const r = height / 2
  const w = Math.max(width, height)
  const dotR = Math.min(3.2, height * 0.22)
  const dotCx = x + w - r
  const dotCy = y + height / 2

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={height}
        rx={r}
        ry={r}
        fill={props.fill}
      />
      <circle cx={dotCx} cy={dotCy} r={dotR} fill="#0a0a0a" />
    </g>
  )
}

/** Vertical capsule bar with a black dot near the top end */
function VerticalCapsuleBar(props: BarShapeProps) {
  const x = props.x ?? 0
  const y = props.y ?? 0
  const width = Math.max(props.width ?? 0, 0)
  const height = Math.max(props.height ?? 0, 0)
  if (width <= 0 || height <= 0) return null

  const r = width / 2
  const h = Math.max(height, width)
  const top = y + (props.height ?? 0) - h
  const dotR = Math.min(3.2, width * 0.22)
  const dotCx = x + width / 2
  const dotCy = top + r

  return (
    <g>
      <rect
        x={x}
        y={top}
        width={width}
        height={h}
        rx={r}
        ry={r}
        fill={props.fill}
      />
      <circle cx={dotCx} cy={dotCy} r={dotR} fill="#0a0a0a" />
    </g>
  )
}

function CapsuleDots({ count = 3 }: { count?: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="size-1.5 rounded-full bg-zinc-950" />
      ))}
    </div>
  )
}

function CapsulePanel({
  title,
  description,
  className,
  children,
}: {
  title: string
  description: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/95",
        className
      )}
    >
      <div className="flex flex-col gap-2 px-5 pt-4 pb-2">
        <CapsuleDots />
        <div>
          <h2 className="text-sm font-medium tracking-tight text-zinc-100">
            {title}
          </h2>
          <p className="text-xs text-zinc-500">{description}</p>
        </div>
      </div>
      <div className="px-3 pb-4 pt-1">{children}</div>
    </div>
  )
}

export function HistoryDiagram({
  jobs = [],
}: {
  jobs?: HistoryJob[]
}) {
  const timeline = React.useMemo(() => buildTimeline(jobs), [jobs])
  const byNode = React.useMemo(() => buildByNode(jobs), [jobs])

  const dayTotals = React.useMemo(
    () =>
      timeline.map((row) => ({
        day: row.day,
        total: row.done + row.failed + row.running + row.queued,
        done: row.done,
        failed: row.failed,
        running: row.running,
        queued: row.queued,
      })),
    [timeline]
  )

  if (jobs.length === 0) {
    return (
      <section className="rounded-[2rem] border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
        No data for diagram
      </section>
    )
  }

  return (
    <section className="grid gap-3 lg:grid-cols-5">
      <CapsulePanel
        className="lg:col-span-3"
        title="Jobs by day"
        description="Capsule bars · black marker at the tip"
      >
        <ChartContainer
          config={dayConfig}
          className="aspect-auto h-[220px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={dayTotals}
            margin={{ left: 0, right: 8, top: 12, bottom: 0 }}
            barCategoryGap="34%"
          >
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => {
                    const row = item?.payload as
                      | (typeof dayTotals)[number]
                      | undefined
                    if (!row) return String(value)
                    return (
                      <div className="flex flex-col gap-0.5 font-mono text-[11px]">
                        <span>total {row.total}</span>
                        <span>done {row.done}</span>
                        <span>failed {row.failed}</span>
                      </div>
                    )
                  }}
                />
              }
            />
            <Bar
              dataKey="total"
              fill="var(--color-total)"
              shape={VerticalCapsuleBar}
              barSize={18}
            />
          </BarChart>
        </ChartContainer>
      </CapsulePanel>

      <CapsulePanel
        className="lg:col-span-2"
        title="Jobs by node"
        description="Capsule bars · black marker on the right"
      >
        <ChartContainer
          config={nodeConfig}
          className="aspect-auto h-[220px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={byNode}
            layout="vertical"
            margin={{ left: 8, right: 12, top: 8, bottom: 0 }}
            barCategoryGap="36%"
          >
            <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.06)" />
            <YAxis
              dataKey="node"
              type="category"
              tickLine={false}
              axisLine={false}
              width={88}
              tick={{ fontSize: 11 }}
            />
            <XAxis
              type="number"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar
              dataKey="jobs"
              fill="var(--color-jobs)"
              shape={HorizontalCapsuleBar}
              barSize={16}
            />
          </BarChart>
        </ChartContainer>
      </CapsulePanel>
    </section>
  )
}
