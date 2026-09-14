<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type ChartOptions,
} from 'chart.js'

import { useUiStore } from '@/stores/ui.store'

/**
 * One Chart.js host for every chart in the console.
 *
 * Only the pieces actually used are registered, rather than the whole library, which keeps the
 * bundle honest. The chart is rebuilt when the theme or the direction changes: gridlines and labels
 * have to be legible in dark mode, and an RTL layout reverses the axis.
 */
Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
)

const props = defineProps<{
  config: ChartConfiguration
  /** A text alternative, since a canvas is opaque to a screen reader. */
  summary: string
  height?: string
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const chart = shallowRef<Chart | null>(null)
const ui = useUiStore()

function build() {
  chart.value?.destroy()

  const element = canvas.value
  if (element === null) return

  const grid = ui.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(36,22,52,0.08)'
  const text = ui.isDark ? '#CBD5E1' : '#8A7F95'

  const config = props.config

  // Chart.js types each scale by the chart type it belongs to, so a merged object built here is
  // wider than any one of those unions. The theme and direction defaults are assembled separately
  // and handed over as scale options, which is the one place a cast is honest: the shapes below are
  // exactly what Chart.js documents for a cartesian scale.
  const scales =
    config.type === 'doughnut'
      ? undefined
      : ({
          x: {
            reverse: ui.locale === 'ar',
            grid: { display: false },
            border: { color: grid },
            ticks: { color: text, font: { size: 11 } },
            ...config.options?.scales?.x,
          },
          y: {
            position: ui.locale === 'ar' ? 'right' : 'left',
            beginAtZero: true,
            grid: { color: grid },
            border: { display: false },
            ticks: { color: text, font: { size: 11 }, precision: 0 },
            ...config.options?.scales?.y,
          },
        } as ChartOptions['scales'])

  chart.value = new Chart(element, {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // The whole chart mirrors in Arabic, so the axis reads in the same direction as the page.
      locale: ui.locale === 'ar' ? 'ar-IQ' : 'en-US',
      ...config.options,
      plugins: {
        ...config.options?.plugins,
        legend: {
          ...config.options?.plugins?.legend,
          labels: {
            color: text,
            usePointStyle: true,
            boxWidth: 8,
            ...config.options?.plugins?.legend?.labels,
          },
        },
      },
      scales,
    },
  })
}

watch(() => [props.config, ui.isDark, ui.locale], build, { deep: true, immediate: false })

// The canvas only exists after mount; build once it does.
watch(canvas, (element) => {
  if (element !== null) build()
})

onBeforeUnmount(() => chart.value?.destroy())
</script>

<template>
  <div class="relative w-full" :style="{ height: height ?? '280px' }">
    <canvas ref="canvas" role="img" :aria-label="summary" />
  </div>
</template>
