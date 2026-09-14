<script setup lang="ts">
import { computed } from 'vue'
import {
  BarChart3,
  Building2,
  FileText,
  KeyRound,
  LayoutDashboard,
  Link2,
  Megaphone,
  Settings,
  Users,
  Wifi,
} from 'lucide-vue-next'
import type { FunctionalComponent } from 'vue'

import BrandLogo from '@/components/BrandLogo.vue'
import { usePermissions } from '@/stores/permissions'
import { useUiStore } from '@/stores/ui.store'

interface NavItem {
  name: string
  labelKey: string
  icon: FunctionalComponent
  visible: boolean
}

interface NavSection {
  labelKey: string
  items: NavItem[]
}

const ui = useUiStore()
const can = usePermissions()

/**
 * The navigation shows only what this operator can actually open. An Admin sees no API clients or
 * operators entry, because those routes would answer 403 - offering a door that does not open is
 * worse than not showing it.
 */
const sections = computed<NavSection[]>(() =>
  [
    {
      labelKey: 'nav.sections.overview',
      items: [
        {
          name: 'dashboard',
          labelKey: 'nav.dashboard',
          icon: LayoutDashboard,
          visible: true,
        },
        {
          name: 'analytics',
          labelKey: 'nav.analytics',
          icon: BarChart3,
          visible: can.canReadAnalytics.value,
        },
      ],
    },
    {
      labelKey: 'nav.sections.operations',
      items: [
        { name: 'kyc', labelKey: 'nav.kyc', icon: FileText, visible: can.canReadKyc.value },
        {
          name: 'campaigns',
          labelKey: 'nav.campaigns',
          icon: Megaphone,
          visible: can.canReadCampaigns.value,
        },
        {
          name: 'registration-links',
          labelKey: 'nav.registrationLinks',
          icon: Link2,
          visible: can.canReadRegistrationLinks.value,
        },
      ],
    },
    {
      labelKey: 'nav.sections.reference',
      items: [
        {
          name: 'subscriptions',
          labelKey: 'nav.subscriptions',
          icon: Wifi,
          visible: can.canReadSubscriptions.value,
        },
        {
          name: 'master-data',
          labelKey: 'nav.masterData',
          icon: Building2,
          visible: can.canReadMasterData.value,
        },
      ],
    },
    {
      labelKey: 'nav.sections.administration',
      items: [
        {
          name: 'api-clients',
          labelKey: 'nav.apiClients',
          icon: KeyRound,
          visible: can.canManageApiClients.value,
        },
        {
          name: 'operators',
          labelKey: 'nav.operators',
          icon: Users,
          visible: can.canManageOperators.value,
        },
        { name: 'settings', labelKey: 'nav.settings', icon: Settings, visible: true },
      ],
    },
  ]
    .map((section) => ({ ...section, items: section.items.filter((item) => item.visible) }))
    .filter((section) => section.items.length > 0),
)

const collapsed = computed(() => ui.sidebarCollapsed)
</script>

<template>
  <nav
    :class="[
      'flex h-full flex-col bg-brand-800 text-white transition-[width] duration-200',
      collapsed ? 'w-[76px]' : 'w-64',
    ]"
    :aria-label="$t('app.title')"
  >
    <!-- Collapsed, the lockup centres on the rail so it sits over the icon column below it rather
         than hanging off the edge; expanded, it lines up with the section headings. -->
    <div
      :class="[
        'flex h-16 flex-none items-center gap-2',
        collapsed ? 'justify-center px-3' : 'px-4',
      ]"
    >
      <RouterLink
        :to="{ name: 'dashboard' }"
        class="flex items-center rounded-lg focus-visible:ring-offset-brand-800"
        @click="ui.closeSidebar()"
      >
        <BrandLogo v-if="!collapsed" />
        <BrandLogo v-else variant="mark" />
        <span class="sr-only">{{ $t('app.title') }}</span>
      </RouterLink>
    </div>

    <div class="flex-1 overflow-y-auto px-3 pb-4">
      <div v-for="section in sections" :key="section.labelKey" class="mb-5">
        <p
          v-if="!collapsed"
          class="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/45"
        >
          {{ $t(section.labelKey) }}
        </p>
        <!-- Collapsed, the heading is hidden but kept for screen readers, so the grouping survives. -->
        <p v-else class="sr-only">{{ $t(section.labelKey) }}</p>

        <ul class="space-y-0.5">
          <li v-for="item in section.items" :key="item.name">
            <RouterLink
              v-slot="{ isActive, href, navigate }"
              :to="{ name: item.name }"
              custom
            >
              <a
                :href="href"
                :class="[
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:ring-offset-brand-800',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/75 hover:bg-white/10 hover:text-white',
                  collapsed ? 'justify-center' : '',
                ]"
                :aria-current="isActive ? 'page' : undefined"
                :title="collapsed ? $t(item.labelKey) : undefined"
                @click="
                  (event: MouseEvent) => {
                    navigate(event)
                    ui.closeSidebar()
                  }
                "
              >
                <component :is="item.icon" class="h-[18px] w-[18px] flex-none" aria-hidden="true" />
                <span v-if="!collapsed" class="truncate">{{ $t(item.labelKey) }}</span>
                <span v-else class="sr-only">{{ $t(item.labelKey) }}</span>
              </a>
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>
