<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" wide>
    <div class="w-full px-4 py-6 sm:px-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-semibold text-ink-gray-9">Performance metrics</h1>
        <!-- The one context switcher, next to the title: its label is the
             current context, and picking an option is how you change it (no
             separate back control). -->
        <Select
          v-if="liveSites.length"
          :model-value="contextValue"
          variant="subtle"
          size="sm"
          class="min-w-56"
          :options="contextOptions"
          @update:model-value="switchContext"
        />
      </div>
      <div class="flex items-center gap-2">
        <!-- Server view groups its charts into metric categories (System vs the
             database's own metrics); the site view has a single app-metric set. -->
        <Select v-if="!activeSite" v-model="metric" variant="subtle" size="sm" :options="METRICS" />
        <Dropdown :options="rangeMenu" placement="bottom-end">
          <Button variant="subtle" size="sm" icon-right="lucide-chevron-down">
            <span class="flex items-center gap-1.5">
              <span v-if="range === 'live'" class="h-1.5 w-1.5 rounded-full bg-green-500" />
              {{ rangeLabel }}
            </span>
          </Button>
        </Dropdown>
      </div>
    </div>

    <!-- ── Server view: infrastructure metrics ─────────────────────────── -->
    <template v-if="!activeSite">
      <!-- Resource summary — a System-metrics read-out; the Database category
           has its own headline charts, so this strip is hidden there. -->
      <div v-if="metric === 'system'" class="mt-5 grid gap-4 sm:grid-cols-3">
        <div class="rounded-lg border border-outline-gray-2 bg-surface-base p-4">
          <div class="text-sm text-ink-gray-5">CPU</div>
          <Progress :value="health.cpuPct" size="sm" class="mt-3" />
          <div class="mt-2 text-sm text-ink-gray-7">{{ health.cpuPct }}% of {{ specs?.vcpu ?? '—' }} vCPUs</div>
        </div>
        <div class="rounded-lg border border-outline-gray-2 bg-surface-base p-4">
          <div class="text-sm text-ink-gray-5">Memory</div>
          <Progress :value="health.memPct" size="sm" class="mt-3" />
          <div class="mt-2 text-sm text-ink-gray-7">{{ health.memUsed }} GB of {{ health.memTotal }} GB</div>
        </div>
        <div class="rounded-lg border border-outline-gray-2 bg-surface-base p-4">
          <div class="text-sm text-ink-gray-5">Storage</div>
          <Progress :value="health.diskPct" size="sm" class="mt-3" />
          <div class="mt-2 text-sm text-ink-gray-7">{{ health.diskUsed }} GB of {{ health.diskTotal }} GB</div>
        </div>
      </div>

      <!-- Metric charts — System or Database, per the category selector -->
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <div v-for="c in serverCharts" :key="c.title" class="rounded-lg border border-outline-gray-2 bg-surface-base">
          <div class="h-[300px]"><AxisChart :config="c" /></div>
        </div>
      </div>
    </template>

    <!-- ── Site view: application metrics ──────────────────────────────── -->
    <template v-else>
      <!-- Uptime is the site's health headline, so it leads the page as a
           full-width band rather than one tile in the grid: the percentage
           reads on the left, and the per-interval status timeline spans the
           whole window on the right (each segment hoverable for its interval
           and status). Keeping it out of the grid also lets the six frequent/
           slowest breakdowns pair up cleanly two-by-two below. -->
      <div class="mt-10 mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div class="sm:shrink-0">
          <div class="text-3xl font-semibold tracking-tight text-ink-gray-9">{{ site.uptime }}%</div>
          <div class="text-p-sm text-ink-gray-5">Uptime</div>
          <div v-if="site.uptimeNote" class="mt-0.5 text-p-xs text-ink-gray-5">{{ site.uptimeNote }}</div>
        </div>
        <!-- Chart column hugs the ticks' intrinsic width (no flex-1) so the
             "Now" caption's right edge lands on the last tick instead of the
             far side of an over-wide column. -->
        <div class="flex flex-col">
          <!-- Fixed-width ticks with an even gap (not flex-1 slabs, which merge
               into one green block). Left-packed rather than justified so the
               ticks stay a consistent width apart across ranges. -->
          <div class="flex h-8 items-stretch gap-1">
            <Tooltip v-for="(bar, i) in site.uptimeBars" :key="i" :text="bar.label" :hover-delay="0">
              <span class="w-1.5 rounded-sm" :class="bar.up ? 'bg-[var(--ink-green-6)]' : 'bg-[var(--ink-red-6)]'" />
            </Tooltip>
          </div>
          <div class="mt-2 flex justify-between text-xs text-ink-gray-4">
            <span>{{ site.uptimeStart }}</span><span>Now</span>
          </div>
        </div>
      </div>

      <!-- Request / job / IP / report breakdowns, paired frequent ↔ slowest -->
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <div v-for="c in site.charts" :key="c.title" class="rounded-lg border border-outline-gray-2 bg-surface-base">
          <div class="h-[300px]"><AxisChart :config="c" /></div>
        </div>
      </div>
    </template>
    </div>
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AxisChart, Button, Dropdown, Progress, Select, Tooltip } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)

// Two levels, mirroring the DB analyzer: the server's infrastructure metrics by
// default, or one site's application metrics via ?site=<id>.
const liveSites = computed(() => (server.value?.sites || []).filter((s) => s.status === 'live'))
const activeSite = computed(() => liveSites.value.find((s) => s.id === route.query.site) || null)

watchEffect(() => {
  if (!server.value) {
    router.replace('/')
    return
  }
  // A ?site= that no longer resolves (deleted/renamed) falls back to server view.
  if (route.query.site && !activeSite.value) router.replace({ query: {} })
})

// The context switcher is the single control: its value is the current context,
// and choosing an option navigates. '' is the server (infrastructure) view.
const contextValue = computed(() => route.query.site || '')
const contextOptions = computed(() => [
  { label: `Server · ${server.value?.name ?? ''}`, value: '', icon: 'lucide-server' },
  ...liveSites.value.map((s) => ({ label: s.name, value: s.id, icon: 'lucide-globe' })),
])
function switchContext(val) {
  router.push({ query: val ? { site: val } : {} })
}

// On the site view, "Analytics" links back to the server view (like Tasks →
// TaskDetail and the DB analyzer's server → site drill); on the server view it's
// the current page, so it's plain text. "Insights" is a section, never a route.
const crumbs = computed(() => {
  const base = [{ label: 'Insights' }]
  return activeSite.value
    ? [...base, { label: 'Performance metrics', route: `/manage/${server.value?.id}/analytics` }, { label: activeSite.value.name }]
    : [...base, { label: 'Performance metrics' }]
})
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
// Live streaming is meaningless for a single site in a mock — the server view
// keeps it (and its default), but the site view hides Live and defaults to 24h.
const rangeMenu = computed(() =>
  (activeSite.value ? RANGES.filter((r) => r.value !== 'live') : RANGES).map((r) => ({
    label: r.label,
    onClick: () => (range.value = r.value),
  })),
)
watchEffect(() => {
  if (activeSite.value && range.value === 'live') range.value = '24h'
})

// — Metric category (server view only) — mirrors pilot's System/Database split.
// System is the infrastructure read-out (CPU, memory, network, …); Database is
// the MariaDB engine's own metrics (queries, connections, buffer pool, …).
const METRICS = [
  { label: 'System', value: 'system' },
  { label: 'Database', value: 'database' },
]
const metric = ref('system')

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

// — Bars are aggregated telemetry, not a live signal —
// The server line charts sample a continuous signal at 150 points. Request and
// background-job charts are the opposite: discrete event counts bucketed into
// coarse intervals, so a window reads as a few dozen bars, not a dense wall.
const BAR_POINTS = 80
function barTimes(spanMin) {
  const now = Date.now()
  const stepMs = (spanMin * 60000) / (BAR_POINTS - 1)
  return Array.from({ length: BAR_POINTS }, (_, i) => now - (BAR_POINTS - 1 - i) * stepMs)
}

// Real request/job load arrives in bursts with idle gaps between (overnight
// lulls, quiet spells) — not the smooth pull-back of `wander`. Every series in
// a chart shares one activity mask so the whole stack rises and falls together,
// giving the clustered-bars-with-empty-stretches shape of the real dashboards.
// Idle buckets are exactly 0, which the chart draws as no bar and the tooltip
// filters out. `fill` is roughly the fraction of buckets that see activity —
// low for "slowest" panels (a handful of tall bars), higher for "frequent".
//
// `spiky` changes the *shape* of that activity, not the amount: "frequent"
// panels see contiguous bursts (2–9 buckets wide), but "slowest" panels plot
// outlier events, which in the real dashboards land as isolated tall bars
// scattered across the window. Spiky mode makes each active run 1–2 buckets
// wide with wider idle gaps, so the same `fill` reads as lone spikes, not clumps.
function burstRows(times, defs, rng, { fill = 0.55, spiky = false } = {}) {
  const n = times.length
  const active = new Array(n).fill(false)
  let i = Math.floor(rng() * 5)
  let covered = 0
  while (i < n && covered < n * fill) {
    i += spiky ? 3 + Math.floor(rng() * 10) : 2 + Math.floor(rng() * 8) // idle gap
    const span = spiky ? 1 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 9) // active burst
    for (let k = 0; k < span && i < n; k++, i++) {
      active[i] = true
      covered++
    }
  }
  const cols = defs.map((d) => {
    const vals = new Array(n)
    for (let j = 0; j < n; j++) {
      if (!active[j]) {
        vals[j] = 0
        continue
      }
      let v = d.base + (rng() - 0.5) * d.amp
      if (rng() < 0.15) v += d.amp * (0.5 + rng()) // occasional taller bar
      vals[j] = Math.max(d.min ?? 0, Math.round(Math.min(d.max ?? Infinity, v) * 100) / 100)
    }
    return { name: d.name, vals }
  })
  return times.map((t, idx) => {
    const row = { time: t }
    cols.forEach((c) => (row[c.name] = c.vals[idx]))
    return row
  })
}

// — Chart styling lifted from frappe/pilot (ChartCard.vue / Analytics.vue) —
// Dashed grid on both axes; smooth filled line series with a light 0.25 area fill.
const GRID = { show: true, lineStyle: { type: 'dashed', color: 'var(--outline-gray-2)' } }

// Long dotted route/job names otherwise get clipped mid-word by the scroll
// legend as it straddles the pager. A fixed text width truncates each item
// cleanly with an ellipsis instead — merged into the chart's echart options.
const LEGEND = { legend: { textStyle: { width: 150, overflow: 'truncate' } } }

// frappe-ui packs the plot right under the title (grid.top ≈ 44). Nudge the
// plot area down so every card has clear breathing room below its title. Deep-
// merged over the computed grid, so left/right/bottom/containLabel survive.
const TITLE_GAP = { grid: { top: 64 } }

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

// Bar counterpart of lineSeries — used by the site view's request/job
// breakdowns. Stacking + top-only rounded corners come from the chart's
// `stacked: true`; here we just keep the bars narrow so a window reads as many
// discrete interval bars (the aggregated-telemetry look), not fat blocks.
function barSeries(name, color) {
  return {
    name,
    type: 'bar',
    color,
    echartOptions: {
      barMaxWidth: 14,
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
const PALETTE = ['#2490ef', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316']

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
  // The unit sits at the top of the y-axis. Passing it as frappe-ui's `title`
  // (rather than a raw echarts `name`) gives it the library's intended
  // treatment — an `↑ unit` marker on a surface-base chip that reads cleanly
  // over the gridlines. '' hides it (e.g. Load Average).
  const yAxis = (title, extra = {}) => ({ yMin: 0, title, echartOptions: { splitLine: GRID }, ...extra })

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
    // Same title→plot breathing room as the site cards.
  ].map((c) => ({ ...c, echartOptions: { ...TITLE_GAP, ...c.echartOptions } }))
})

// The MariaDB engine's own metrics, mirroring pilot's Database analytics: query
// mix, connection headroom, and the InnoDB buffer-pool health checks. Same
// seeded, range-aware generators as the system charts, distinct seed suffix.
const dbCharts = computed(() => {
  const r = RANGES.find((r) => r.value === range.value)
  const times = timeStamps(r.spanMin)
  const seed = hashStr(`${server.value.id}:${range.value}:db`)
  const rng = (n) => mulberry32(seed + n * 7919)

  const xAxis = {
    key: 'time',
    type: 'time',
    timeGrain: r.grain,
    echartOptions: { min: times[0], max: times[times.length - 1], splitLine: GRID },
  }
  const yAxis = (title, extra = {}) => ({ yMin: 0, title, echartOptions: { splitLine: GRID }, ...extra })

  // The buffer-pool ratio chart carries pilot's two advisory thresholds as
  // dashed reference lines — too-high wastes RAM, too-low starves the cache.
  const withThresholds = (series) => {
    series.echartOptions = {
      ...series.echartOptions,
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: 'var(--ink-red-5)', type: 'dashed' },
        label: { color: 'var(--ink-gray-6)', fontSize: 11 },
        data: [
          { yAxis: 65, label: { formatter: 'Too High InnoDB Buffer Pool (65%)', position: 'insideEndTop' } },
          { yAxis: 15, label: { formatter: 'Too Low InnoDB Buffer Pool (15%)', position: 'insideEndBottom' } },
        ],
      },
    }
    return series
  }

  const QUERY_KINDS = ['Insert', 'Update', 'Delete', 'Select', 'Other']
  return [
    {
      title: 'Queries',
      xAxis,
      yAxis: yAxis('count'),
      stacked: true,
      data: rows(
        times,
        [
          { name: 'Insert', base: 30, amp: 25, spike: 0.08, spikeAmp: 120 },
          { name: 'Update', base: 22, amp: 18, spike: 0.06, spikeAmp: 90 },
          { name: 'Delete', base: 8, amp: 8, spike: 0.05, spikeAmp: 40 },
          { name: 'Select', base: 90, amp: 60, spike: 0.1, spikeAmp: 200 },
          { name: 'Other', base: 12, amp: 10, spike: 0.05, spikeAmp: 50 },
        ],
        rng(1),
      ),
      series: QUERY_KINDS.map((n, i) => lineSeries(n, PALETTE[i], true)),
    },
    {
      title: 'DB connections',
      xAxis,
      // Connected sits well under the 150 cap — the empty space above the fill is
      // the headroom. The cap is a ceiling, not a series, so it's a dashed
      // reference line (a filled second series would flood the plot and read as
      // "full" rather than "room to spare"). y-axis tops out just above the cap.
      yAxis: yAxis('connections', { yMax: 180 }),
      data: rows(
        times,
        [{ name: 'Connected', base: 22, amp: 10, spike: 0.05, spikeAmp: 20, max: 150 }],
        rng(2),
      ),
      series: [
        {
          ...lineSeries('Connected', PALETTE[0]),
          echartOptions: {
            ...lineSeries('Connected', PALETTE[0]).echartOptions,
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: 'var(--ink-red-5)', type: 'dashed' },
              label: { color: 'var(--ink-gray-6)', fontSize: 11 },
              data: [{ yAxis: 150, label: { formatter: 'Max connections (150)', position: 'insideEndTop' } }],
            },
          },
        },
      ],
    },
    {
      title: 'Average row lock time (ms)',
      xAxis,
      yAxis: yAxis('ms', { yMax: 1 }),
      data: rows(times, [{ name: 'Lock time', base: 0.02, amp: 0.03, max: 1 }], rng(3)),
      series: [lineSeries('Lock time', PALETTE[0])],
    },
    {
      title: 'Buffer pool size',
      xAxis,
      yAxis: yAxis('bytes'),
      data: rows(
        times,
        [{ name: 'Buffer pool', base: 134217728, amp: 0, min: 134217728, max: 134217728 }],
        rng(4),
      ),
      series: [lineSeries('Buffer pool', PALETTE[0])],
    },
    {
      title: 'Buffer pool size of total RAM',
      xAxis,
      yAxis: yAxis('%', { yMax: 100 }),
      data: rows(times, [{ name: 'Buffer pool', base: 42, amp: 2, max: 100 }], rng(5)),
      series: [withThresholds(lineSeries('Buffer pool', PALETTE[0]))],
    },
    {
      title: 'Buffer pool miss percent',
      xAxis,
      yAxis: yAxis('%', { yMax: 1 }),
      data: rows(times, [{ name: 'Miss percent', base: 0.04, amp: 0.05, max: 1 }], rng(6)),
      series: [lineSeries('Miss percent', PALETTE[0])],
    },
  ].map((c) => ({ ...c, echartOptions: { ...TITLE_GAP, ...c.echartOptions } }))
})

const serverCharts = computed(() => (metric.value === 'database' ? dbCharts.value : charts.value))

// ── Site application metrics ───────────────────────────────────────────────
// A site owner's read-out: uptime, plus the request / background-job / IP /
// report breakdowns. Deterministic per site + range (distinct seed from the
// server charts), so every site reads differently but stably.
// Compact interval label for uptime-bar tooltips + the strip's start marker.
// Coarser windows (7d) need the date; intraday windows just need the time.
function fmtWin(ms, grain) {
  const d = new Date(ms)
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return grain === 'day' ? `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}` : time
}

// frappe-ui's default axis tooltip lists every non-zero series and grows as wide
// as its longest label — with a dozen dotted job names in one bucket it covers
// the whole chart. This replaces the formatter with a fixed-width card capped to
// the top few contributors (a "+ N more" line accounts for the rest), matching
// the library's label/number formatting so it reads the same, just contained.
const TOOLTIP_CAP = 6
function fmtLabel(name) {
  // Mirrors frappe-ui's formatLabel: split on _, capitalize each word.
  return name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return String(v)
  const s = v.toString()
  const dot = s.indexOf('.')
  const p = dot === -1 ? 0 : Math.min(s.length - dot - 1, 2)
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: p, maximumFractionDigits: p }).format(v)
}
function tipDate(ms, grain) {
  const d = new Date(ms)
  const date = d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
  if (grain === 'day') return date
  const opts = grain === 'hour' ? { hour: 'numeric' } : { hour: 'numeric', minute: '2-digit' }
  return `${date}, ${d.toLocaleTimeString([], opts)}`
}
function cappedTooltip(grain) {
  return {
    confine: true,
    extraCssText: 'max-width: 260px;',
    formatter: (params) => {
      const rows = (Array.isArray(params) ? params : [params])
        .filter((p) => p.value?.[1] !== 0 && p.value?.[1] != null)
        .sort((a, b) => b.value[1] - a.value[1])
      if (!rows.length) return ''
      const head = `<div class="mb-1 text-ink-gray-6">${tipDate(rows[0].value[0], grain)}</div>`
      const body = rows
        .slice(0, TOOLTIP_CAP)
        .map(
          (p) =>
            `<div class="flex items-center gap-3">
               <div class="flex min-w-0 flex-1 items-center gap-1.5">${p.marker}<span class="truncate">${fmtLabel(p.seriesName)}</span></div>
               <span class="font-semibold text-ink-gray-9">${fmtNum(p.value[1])}</span>
             </div>`,
        )
        .join('')
      const more =
        rows.length > TOOLTIP_CAP ? `<div class="mt-1 text-ink-gray-5">+ ${rows.length - TOOLTIP_CAP} more</div>` : ''
      return `<div class="flex w-[236px] flex-col gap-1 text-xs">${head}${body}${more}</div>`
    },
  }
}

// Raw route / job / report identifiers — the chart legend runs each through
// frappe-ui's `formatLabel` (split on `_`, capitalize words), so a dotted+snake
// name like `helpdesk.search.build_index_if_not_exists` renders exactly as the
// real dashboards show it ("Helpdesk.search.build Index If Not Exists"). Enough
// series that the legend pages (the reference's "1/3"), like the live product.
const REQ_ROUTES = [
  '/api/method/frappe.client.get_list',
  '/api/method/frappe.desk.search.search_link',
  '/api/method/frappe.client.get_count',
  '/app/website',
  '/api/method/upload_file',
  '/api/method/frappe.desk.form.load.getdoc',
]
const BG_JOBS = [
  'frappe.email.queue.flush',
  'helpdesk.search.build_index_if_not_exists',
  'frappe.email.queue.retry_send',
  'frappe.monitor.flush',
  'frappe.integrations.google_calendar.sync',
  'frappe.utils.background_jobs.execute_job',
  'frappe.desk.doctype.rq_job.rq_job.remove_failed_jobs',
  'frappe.website.doctype.web_page.web_page.check_publish',
  'frappe.core.doctype.log_settings.log_settings.clear_logs',
]
const IP_ADDRS = ['203.0.113.5', '198.51.100.23', '192.0.2.44', '203.0.113.88', '198.51.100.7', '192.0.2.130']
const REPORT_NAMES = [
  'General Ledger',
  'Stock Balance',
  'Accounts Receivable',
  'Sales Register',
  'Trial Balance',
  'Item-wise Sales',
]

const site = computed(() => {
  if (!activeSite.value) return null
  const r = RANGES.find((x) => x.value === range.value)
  const times = barTimes(r.spanMin)
  const seed = hashStr(`${activeSite.value.id}:${range.value}`)
  const rng = (n) => mulberry32(seed + n * 7919)

  const xAxis = {
    key: 'time',
    type: 'time',
    timeGrain: r.grain,
    echartOptions: { min: times[0], max: times[times.length - 1], splitLine: GRID },
  }
  // Unit at the top of the y-axis, via frappe-ui's `title` (the `↑ unit` chip) —
  // matching the reference's "Runs" / "Duration (s)" labels.
  const yAxis = (title) => ({ yMin: 0, title, echartOptions: { splitLine: GRID } })

  // `stacked` at the chart level: frappe-ui stacks the bars and rounds only the
  // top of each column. `fill` sets how busy the window is — a handful of tall
  // bars for "slowest", denser clusters for "frequent".
  const barsChart = (title, unit, defs, n, fill, spiky = false) => ({
    title,
    xAxis,
    yAxis: yAxis(unit),
    stacked: true,
    echartOptions: { ...LEGEND, ...TITLE_GAP, tooltip: cappedTooltip(r.grain) },
    data: burstRows(times, defs, rng(n), { fill, spiky }),
    series: defs.map((d, i) => barSeries(d.name, PALETTE[i % PALETTE.length])),
  })

  // Uptime strip: all-green at 100%; a minority of sites show one rare blip.
  // Each bar spans an equal slice of the selected window, so hovering names the
  // interval it covers and whether the site was up.
  const blip = rng(20)() < 0.15
  const start = times[0]
  const end = times[times.length - 1]
  const step = (end - start) / 36
  const uptimeBars = Array.from({ length: 36 }, (_, i) => {
    const up = !(blip && i === 30)
    const from = start + i * step
    return {
      up,
      label: `${fmtWin(from, r.grain)} – ${fmtWin(from + step, r.grain)} · ${up ? 'Operational' : 'Downtime'}`,
    }
  })
  const uptime = blip ? '99.97' : '100.00'
  const uptimeNote = blip ? '1 brief outage' : ''

  return {
    uptime,
    uptimeNote,
    uptimeBars,
    uptimeStart: fmtWin(start, r.grain),
    charts: [
      barsChart('Frequent requests', 'Requests', REQ_ROUTES.map((name) => ({ name, base: 4, amp: 3, min: 0, max: 14 })), 6, 0.55),
      barsChart('Slowest requests', 'Duration (s)', REQ_ROUTES.slice(0, 4).map((name) => ({ name, base: 0.15, amp: 0.14, min: 0, max: 1 })), 7, 0.14, true),
      barsChart('Frequent background jobs', 'Runs', BG_JOBS.map((name) => ({ name, base: 3, amp: 3, min: 0, max: 12 })), 8, 0.5),
      barsChart('Slowest background jobs', 'Duration (s)', BG_JOBS.map((name) => ({ name, base: 0.4, amp: 0.5, min: 0, max: 3 })), 9, 0.2, true),
      barsChart('Frequent IPs', 'Requests', IP_ADDRS.map((name) => ({ name, base: 3, amp: 2.5, min: 0, max: 10 })), 10, 0.5),
      barsChart('Slowest reports', 'Duration (s)', REPORT_NAMES.map((name) => ({ name, base: 0.6, amp: 0.6, min: 0, max: 4 })), 11, 0.2, true),
    ],
  }
})
</script>
