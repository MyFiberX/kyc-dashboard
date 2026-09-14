<script setup lang="ts">
import { computed } from 'vue'

import { baseURL } from '@/api'
import { useUiStore } from '@/stores/ui.store'

/**
 * The FiberX lockup, served by the backend from /brand - see `source` below for why that is
 * resolved against the API base rather than written as a root-relative path.
 *
 * There are two files and the direction decides which: the Arabic layout uses the mirrored lockup
 * with the X on the left, exactly as the customer-facing pages do. The logo is sized by height and
 * capped in width with object-contain, so its aspect ratio is never distorted whatever artwork is
 * dropped into that folder.
 *
 * The mark alone is used where the sidebar is collapsed, since a 3:1 lockup is illegible at that
 * width - it is the same image, cropped to a square by the container rather than squashed.
 */
withDefaults(defineProps<{ variant?: 'full' | 'mark'; className?: string }>(), {
  variant: 'full',
  className: '',
})

const ui = useUiStore()

/**
 * The artwork is served by the API host, not bundled with the dashboard, so its URL is resolved
 * against the same base as every API call. A bare `/brand/...` would resolve against the PAGE's
 * origin, which is only the same host when the two are deployed together - split across hosts it
 * asks the static host for a file that lives on the backend and renders a broken image.
 */
const source = computed(() => {
  const file = ui.locale === 'ar' ? 'fiberx-logo-rtl.png' : 'fiberx-logo.png'
  return `${baseURL}/brand/${file}`
})
</script>

<template>
  <img
    v-if="variant === 'full'"
    :src="source"
    alt="FiberX"
    :class="['h-8 w-auto max-w-[168px] object-contain object-left rtl:object-right', className]"
  />

  <!-- Collapsed rail: a window onto the X, never a squashed copy of the full lockup. -->
  <span v-else :class="['brand-mark', className]">
    <img :src="source" alt="FiberX" />
  </span>
</template>

<style scoped>
/*
  The collapsed mark is a window onto the X, not a resize of the lockup.

  object-fit cannot express this. object-contain first shrinks the whole 2.81:1 lockup to fit the
  window, leaving nothing to slide, and object-cover zooms past the X and clips its arms. So the
  image is scaled by height alone - keeping its aspect, overflowing the window at 2.81x its height -
  and positioned so only the X shows.

  The offsets are measured from the artwork rather than guessed: the X occupies 71.3%-96.2% of the
  LTR file and 3.8%-29.6% of the mirrored RTL one. They are expressed in em, so the crop holds if
  the mark is ever rendered at another size, and the width is a touch wider than the X to leave it
  an even margin on both sides.
*/
.brand-mark {
  display: block;
  position: relative;
  overflow: hidden;
  /* 36px tall at the default 16px root; the width frames the X and excludes the wordmark beside it. */
  height: 2.25em;
  width: 1.95em;
  border-radius: 0.5em;
  flex: none;
}

.brand-mark img {
  position: absolute;
  top: 0;
  height: 2.25em;
  width: auto;
  max-width: none;
  /* Natural width is 2.81 x height = 6.32em. The X starts at 71.3% of that; the window begins just
     past it so the "r" alongside is left outside. */
  left: -4.86em;
}

/* The mirrored file puts the X near the leading edge, so the window barely moves. */
[dir='rtl'] .brand-mark img {
  left: -0.36em;
}
</style>
