<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'

import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
import { useUiStore } from '@/stores/ui.store'

const ui = useUiStore()
const route = useRoute()

// Navigating closes the mobile drawer; leaving it open over the new page is disorienting.
watch(() => route.fullPath, () => ui.closeSidebar())
</script>

<template>
  <div class="flex h-dvh overflow-hidden bg-canvas dark:bg-brand-950">
    <!-- Desktop rail -->
    <aside class="hidden flex-none lg:block">
      <AppSidebar />
    </aside>

    <!-- Mobile drawer. The sidebar slides from the start edge, which flips with the direction. -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="ui.sidebarOpen"
        class="fixed inset-0 z-40 bg-brand-950/50 backdrop-blur-sm lg:hidden"
        @click="ui.closeSidebar()"
      />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-200 ease-out"
      enter-from-class="-translate-x-full rtl:translate-x-full"
      leave-active-class="transition-transform duration-150 ease-in"
      leave-to-class="-translate-x-full rtl:translate-x-full"
    >
      <aside v-if="ui.sidebarOpen" class="fixed inset-y-0 start-0 z-50 lg:hidden">
        <AppSidebar />
      </aside>
    </Transition>

    <div class="flex min-w-0 flex-1 flex-col">
      <AppTopbar />

      <main class="flex-1 overflow-y-auto">
        <div class="mx-auto w-full max-w-[1600px] p-4 sm:p-6">
          <RouterView v-slot="{ Component }">
            <component :is="Component" />
          </RouterView>
        </div>
      </main>
    </div>
  </div>
</template>
