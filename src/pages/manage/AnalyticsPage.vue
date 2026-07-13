<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" wide>
    <div class="w-full px-4 py-8 sm:px-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-ink-gray-9">Analytics</h1>
        <p class="mt-1 text-p-base text-ink-gray-5">System and application metrics for {{ server.name }}.</p>
      </div>
      <Dropdown :options="rangeMenu" placement="bottom-end">
        <Button variant="subtle" size="sm" icon-right="lucide-chevron-down">
          <span class="flex items-center gap-1.5">
            <span v-if="range === 'live'" class="h-1.5 w-1.5 rounded-full bg-green-500" />
            {{ rangeLabel }}
          </span>
        </Button>
      </Dropdown>
    </div>

    <!-- Resource summary -->
    <div class="mt-5 grid gap-4 sm:grid-cols-3">
      <div class="rounded-lg border border-outline-gray-2 bg-surface-elevation-1 p-4">
        <div class="text-sm text-ink-gray-5">CPU</div>
        <Progress :value="health.cpuPct" size="sm" class="mt-3" />
        <div class="mt-2 text-sm text-ink-gray-7">{{ health.cpuPct }}% of {{ specs?.vcpu ?? '—' }} vCPUs</div>
      </div>
      <div class="rounded-lg border border-outline-gray-2 bg-surface-elevation-1 p-4">
        <div class="text-sm text-ink-gray-5">Memory</div>
        <Progress :value="health.memPct" size="sm" class="mt-3" />
        <div class="mt-2 text-sm text-ink-gray-7">{{ health.memUsed }} GB of {{ health.memTotal }} GB</div>
      </div>
      <div class="rounded-lg border border-outline-gray-2 bg-surface-elevation-1 p-4">
        <div class="text-sm text-ink-gray-5">Storage</div>
        <Progress :value="health.diskPct" size="sm" class="mt-3" />
        <div class="mt-2 text-sm text-ink-gray-7">{{ health.diskUsed }} GB of {{ health.diskTotal }} GB</div>
      </div>
    </div>

    <!-- Metric charts -->
    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <div
        v-for="c in charts"
        :key="c.title"
        class="rounded-lg border border-outline-gray-2 bg-surface-elevation-1"
      >
        <div class="h-[300px]">
          <AxisChart :config="c" />
        </div>
      </div>
    </div>
    </div>
  </ServerShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AxisChart, Button, Dropdown, Progress } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)
if (!server.value) router.replace('/')

const crumbs = computed(() => [{ label: 'Insights' }, { label: 'Analytics' }])
const health = computed(() => store.healthOf(server.value))
const specs = computed(() => store.specsOf(server.value))

// — Time window control — mirrors frappe/pilot's live analytics —
// Each window spans `spanMin` minutes. Data is a real time series (ms timestamps),
// so the chart uses a `time` x-axis and hovering snaps smoothly to each sample.
// `grain` drives the tooltip's timestamp precision (like the real implementation).
const RANGES = [
  { label: 'Live', value: 'live', spanMin: 30, grain: 'second' },
  { label: 'Last hour', value: '1h', spanMin: 60, grain: 'minute' },
  { label: 'Last 24 hours', value: '24h', spanMin: 1440, grain: 'hour' },
  { label: 'Last 7 days', value: '7d', spanMin: 10080, grain: 'day' },
]
const range = ref('live')
const rangeLabel = computed(() => RANGES.find((r) => r.value === range.value).label)
const rangeMenu = RANGES.map((r) => ({ label: r.label, onClick: () => (range.value = r.value) }))

// — Deterministic demo data: stable per server + range, varied across servers —
const POINTS = 150

function hashStr(str) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Evenly spaced ms timestamps across the window, oldest → newest.
function timeStamps(spanMin) {
  const now = Date.now()
  const stepMs = (spanMin * 60000) / (POINTS - 1)
  return Array.from({ length: POINTS }, (_, i) => now - (POINTS - 1 - i) * stepMs)
}

// A gently wandering line that hovers around `base`, occasionally spiking.
function wander(rng, { base, amp, min = 0, max = Infinity, spike = 0, spikeAmp = 0 }) {
  const out = []
  let v = base
  for (let i = 0; i < POINTS; i++) {
    v += (rng() - 0.5) * amp
    if (rng() < spike) v += spikeAmp * rng()
    v += (base - v) * 0.12 // pull back toward base
    v = Math.max(min, Math.min(max, v))
    out.push(Math.round(v * 100) / 100)
  }
  return out
}

function rows(times, defs, rng) {
  const cols = defs.map((d) => ({ name: d.name, vals: wander(rng, d) }))
  return times.map((t, i) => {
    const row = { time: t }
    cols.forEach((c) => (row[c.name] = c.vals[i]))
    return row
  })
}

// — Chart styling lifted from frappe/pilot (ChartCard.vue / Analytics.vue) —
// Dashed grid on both axes; smooth filled line series with a light 0.25 area fill.
const GRID = { show: true, lineStyle: { type: 'dashed', color: 'var(--outline-gray-2)' } }

function transparent(hex, opacity) {
  const v = parseInt(hex.slice(1), 16)
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${opacity})`
}

// A smooth, symbol-less line with a translucent area — the exact series shape the
// live implementation uses. `stacked` layers series into a cumulative total.
function lineSeries(name, color, stacked = false) {
  return {
    name,
    type: 'line',
    color,
    echartOptions: {
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      showSymbol: false,
      stack: stacked ? 'total' : undefined,
      lineStyle: { width: 1.5 },
      areaStyle: { color: transparent(color, 0.25) },
      emphasis: { focus: 'series' },
    },
  }
}

// Palette taken verbatim from the real implementation.
const CPU_COLORS = {
  'Busy User': '#2490ef',
  'Busy System': '#f59e0b',
  'Busy IOWait': '#ef4444',
  'Busy IRQ': '#8b5cf6',
  'Busy Other': '#ec4899',
}
const MEMORY_COLORS = {
  Used: '#f59e0b',
  'Cached + Buffers': '#2490ef',
  Free: '#10b981',
  'Swap Used': '#ef4444',
}
const LOAD_COLORS = ['#46B37E', '#F2D14B', '#E03636']
const PALETTE = ['#2490ef', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899']

const charts = computed(() => {
  const r = RANGES.find((r) => r.value === range.value)
  const times = timeStamps(r.spanMin)
  const seed = hashStr(`${server.value.id}:${range.value}`)
  // One rng per chart keeps each chart deterministic and independent.
  const rng = (n) => mulberry32(seed + n * 7919)

  // Shared time axis, bounded to the selected window.
  const xAxis = {
    key: 'time',
    type: 'time',
    timeGrain: r.grain,
    echartOptions: { min: times[0], max: times[times.length - 1], splitLine: GRID },
  }
  // `name` is the unit shown at the top of the y-axis ('' hides it, e.g. Load Average).
  const yAxis = (name, extra = {}) => ({ yMin: 0, echartOptions: { name, splitLine: GRID }, ...extra })

  const memTotal = health.value.memTotal
  const memSeries = ['Used', 'Cached + Buffers', 'Free', 'Swap Used']
  const memData = rows(
    times,
    [
      { name: 'Used', base: Math.max(health.value.memUsed - 1, 1), amp: 0.8, max: memTotal },
      { name: 'Cached + Buffers', base: Math.min(2, memTotal * 0.3), amp: 0.4, max: memTotal },
      { name: 'Free', base: Math.max(memTotal - health.value.memUsed - 1, 0.5), amp: 0.5, max: memTotal },
      { name: 'Swap Used', base: 0.2, amp: 0.1, max: memTotal },
    ],
    rng(3),
  )
  const memPeak = memData.reduce(
    (m, p) => Math.max(m, memSeries.reduce((s, k) => s + (p[k] || 0), 0)),
    0,
  )

  return [
    {
      title: 'CPU',
      xAxis,
      yAxis: yAxis('%', { yMax: 100 }),
      data: rows(
        times,
        [
          { name: 'Busy System', base: 3, amp: 1.5, spike: 0.1, spikeAmp: 6, max: 100 },
          { name: 'Busy User', base: 6, amp: 3, spike: 0.12, spikeAmp: 8, max: 100 },
          { name: 'Busy IOWait', base: 0.6, amp: 0.6, max: 100 },
          { name: 'Busy IRQ', base: 0.4, amp: 0.4, max: 100 },
          { name: 'Busy Other', base: 0.8, amp: 0.6, max: 100 },
        ],
        rng(1),
      ),
      series: ['Busy System', 'Busy User', 'Busy IOWait', 'Busy IRQ', 'Busy Other'].map((n) =>
        lineSeries(n, CPU_COLORS[n], true),
      ),
    },
    {
      title: 'Load Average',
      xAxis,
      yAxis: yAxis(''),
      data: rows(
        times,
        [
          { name: 'Load Average 1', base: 0.8, amp: 0.5, spike: 0.12, spikeAmp: 1.4, max: 3 },
          { name: 'Load Average 5', base: 0.7, amp: 0.25, max: 3 },
          { name: 'Load Average 15', base: 0.7, amp: 0.1, max: 3 },
        ],
        rng(2),
      ),
      series: [
        lineSeries('Load Average 1', LOAD_COLORS[0]),
        lineSeries('Load Average 5', LOAD_COLORS[1]),
        lineSeries('Load Average 15', LOAD_COLORS[2]),
      ],
    },
    {
      title: 'Memory',
      xAxis,
      yAxis: yAxis('GB', { yMax: memPeak > 0 ? Math.ceil(memPeak * 1.1) : undefined }),
      data: memData,
      series: memSeries.map((n) => lineSeries(n, MEMORY_COLORS[n], true)),
    },
    {
      title: 'Disk',
      xAxis,
      yAxis: yAxis('%', { yMax: 100 }),
      data: rows(times, [{ name: 'Root Disk', base: health.value.diskPct, amp: 0.6, max: 100 }], rng(4)),
      series: [lineSeries('Root Disk', PALETTE[0])],
    },
    {
      title: 'Network',
      xAxis,
      yAxis: yAxis('MB/s'),
      data: rows(
        times,
        [
          { name: 'Received', base: 0.08, amp: 0.05, spike: 0.15, spikeAmp: 0.5 },
          { name: 'Sent', base: 0.05, amp: 0.03, spike: 0.12, spikeAmp: 0.12 },
        ],
        rng(5),
      ),
      series: ['Received', 'Sent'].map((n, i) => lineSeries(n, PALETTE[i])),
    },
    {
      title: 'Disk I/O',
      xAxis,
      yAxis: yAxis('MB/s'),
      data: rows(
        times,
        [
          { name: 'Read', base: 0.15, amp: 0.1, spike: 0.15, spikeAmp: 1.4 },
          { name: 'Write', base: 0.1, amp: 0.08, spike: 0.15, spikeAmp: 0.5 },
        ],
        rng(6),
      ),
      series: ['Read', 'Write'].map((n, i) => lineSeries(n, PALETTE[i])),
    },
    {
      title: 'Process CPU',
      xAxis,
      yAxis: yAxis('%', { yMax: 100 }),
      data: rows(
        times,
        [
          { name: 'Redis Cache', base: 0.6, amp: 0.4, max: 100 },
          { name: 'Redis Queue', base: 0.5, amp: 0.3, max: 100 },
          { name: 'Socketio', base: 0.4, amp: 0.3, max: 100 },
          { name: 'Web', base: 0.8, amp: 0.5, spike: 0.08, spikeAmp: 4, max: 100 },
          { name: 'Worker Pool', base: 0.7, amp: 0.5, max: 100 },
        ],
        rng(7),
      ),
      series: ['Redis Cache', 'Redis Queue', 'Socketio', 'Web', 'Worker Pool'].map((n, i) =>
        lineSeries(n, PALETTE[i]),
      ),
    },
    {
      title: 'Process Memory',
      xAxis,
      yAxis: yAxis('MB'),
      data: rows(
        times,
        [
          { name: 'Redis Cache', base: 10, amp: 1 },
          { name: 'Redis Queue', base: 4, amp: 0.6 },
          { name: 'Socketio', base: 65, amp: 1.5 },
          { name: 'Web', base: 58, amp: 3 },
          { name: 'Worker Pool', base: 38, amp: 2 },
        ],
        rng(8),
      ),
      series: ['Redis Cache', 'Redis Queue', 'Socketio', 'Web', 'Worker Pool'].map((n, i) =>
        lineSeries(n, PALETTE[i]),
      ),
    },
  ]
})
</script>
