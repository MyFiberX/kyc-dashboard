<script setup lang="ts">
import { computed } from 'vue'

import { useUiStore } from '@/stores/ui.store'

/**
 * The FiberX lockup, shipped with the dashboard from public/brand.
 *
 * The artwork lives in this repo rather than being fetched from the backend, so it is served from
 * the same origin as the page whatever host the API is on, and needs no CORS or network round trip
 * to render. The backend keeps its own copy for the pages it renders itself.
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

const source = computed(() =>
  ui.locale === 'ar' ? '/brand/fiberx-logo-rtl.png' : '/brand/fiberx-logo.png',
)
</script>

<template>
  <img
    v-if="variant === 'full'"
    :src="source"
    alt="FiberX"
    :class="[
      'h-8 w-auto max-w-[168px] object-contain object-left rtl:object-right',
      ui.locale === 'ar' ? '' : 'lockup-ltr',
      className,
    ]"
  />

  <!-- Collapsed rail: a window onto the X, never a squashed copy of the full lockup. -->
  <span v-else :class="['brand-mark', className]">
    <img :src="source" alt="FiberX" />
  </span>
</template>

<style scoped>
/*
  The two source files are padded differently, so at one CSS height they render at two sizes.

  Measured from the artwork: the Arabic file's ink spans 0.4%-99.4% of its canvas height, filling
  it, while the English file's spans 8.8%-88.6% - a fifth of its height is transparent padding.
  Sized by height, the English lockup therefore draws about 20% smaller and, because the padding is
  uneven (8.8% above against 11.4% below), its ink centres at 48.7% rather than 50%.

  The artwork is left untouched, so this is corrected here: scale by 99.0/79.8 to make the two inks
  the same height, and nudge down by the 1.3% the ink sits proud of centre. transform is used
  rather than a larger h-, so the element keeps the same 32px layout box and nothing around it
  shifts. transform-origin is the leading edge so the logo still starts where the text below it
  does, mirrored under RTL - though RTL never takes this class, it costs nothing to keep correct.
*/
.lockup-ltr {
  transform: scale(1.24) translateY(1.3%);
  transform-origin: left center;
}

[dir='rtl'] .lockup-ltr {
  transform-origin: right center;
}

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
