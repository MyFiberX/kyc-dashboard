import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { hasPermission, type Permission } from '@/stores/permissions'
import { useAuthStore } from '@/stores/auth.store'

declare module 'vue-router' {
  interface RouteMeta {
    /** Routes are protected unless they say otherwise. */
    public?: boolean
    /** The permission needed to open this route, if any beyond being signed in. */
    permission?: Permission
    /** i18n key for the page title. */
    titleKey?: string
  }
}

/**
 * Routes exist only for functionality the backend actually has. There is no request-logs route,
 * for example: those are integration-only and no operator token reaches them, so a page for them
 * would be a dead end by construction.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, titleKey: 'auth.signInTitle' },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [
      {
        path: '',
        redirect: { name: 'dashboard' },
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { titleKey: 'dashboard.title' },
      },

      {
        path: 'kyc',
        name: 'kyc',
        component: () => import('@/views/kyc/KycListView.vue'),
        meta: { permission: 'kyc.read', titleKey: 'kyc.title' },
      },
      {
        path: 'kyc/create',
        name: 'kyc-create',
        component: () => import('@/views/kyc/KycCreateView.vue'),
        meta: { permission: 'kyc.create', titleKey: 'kyc.create' },
      },
      {
        path: 'kyc/:id',
        name: 'kyc-detail',
        component: () => import('@/views/kyc/KycDetailView.vue'),
        meta: { permission: 'kyc.read', titleKey: 'kyc.detail' },
      },

      {
        path: 'campaigns',
        name: 'campaigns',
        component: () => import('@/views/campaigns/CampaignListView.vue'),
        meta: { permission: 'campaigns.read', titleKey: 'campaigns.title' },
      },
      {
        path: 'campaigns/:id',
        name: 'campaign-detail',
        component: () => import('@/views/campaigns/CampaignDetailView.vue'),
        meta: { permission: 'campaigns.read', titleKey: 'campaigns.campaign' },
      },

      {
        path: 'subscriptions',
        name: 'subscriptions',
        component: () => import('@/views/subscriptions/SubscriptionListView.vue'),
        meta: { permission: 'subscriptions.read', titleKey: 'subscriptions.title' },
      },

      {
        path: 'analytics',
        name: 'analytics',
        component: () => import('@/views/AnalyticsView.vue'),
        meta: { permission: 'analytics.read', titleKey: 'analytics.title' },
      },

      {
        path: 'master-data',
        name: 'master-data',
        component: () => import('@/views/masterdata/MasterDataView.vue'),
        meta: { permission: 'masterData.read', titleKey: 'masterData.title' },
      },

      {
        path: 'registration-links',
        name: 'registration-links',
        component: () => import('@/views/RegistrationLinksView.vue'),
        meta: { permission: 'registrationLinks.read', titleKey: 'registrationLinks.title' },
      },

      {
        path: 'api-clients',
        name: 'api-clients',
        component: () => import('@/views/admin/ApiClientListView.vue'),
        meta: { permission: 'apiClients.manage', titleKey: 'apiClients.title' },
      },
      {
        path: 'operators',
        name: 'operators',
        component: () => import('@/views/admin/OperatorListView.vue'),
        meta: { permission: 'operators.manage', titleKey: 'operators.title' },
      },

      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { titleKey: 'settings.title' },
      },

      {
        path: 'forbidden',
        name: 'forbidden',
        component: () => import('@/views/ForbiddenView.vue'),
        meta: { titleKey: 'errors.forbiddenTitle' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { public: true, titleKey: 'errors.notFoundTitle' },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

/**
 * Temporary: traces every guard decision to the console.
 *
 * A sign-in that reports success but leaves the operator on the login screen has to be one of these
 * decisions, and reading the code has not settled which. Remove once the cause is known.
 */
function trace(stage: string, detail: Record<string, unknown>): void {
  console.info(`[guard] ${stage}`, detail)
}

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  trace('enter', {
    to: to.fullPath,
    name: String(to.name),
    public: to.meta.public === true,
    initializing: auth.initializing,
    isAuthenticated: auth.isAuthenticated,
    hasToken: auth.accessToken !== null,
    hasProfile: auth.profile !== null,
    role: auth.role,
  })

  // On a hard load the session is restored from the stored refresh token before any decision is
  // made, so a reload on a protected page does not bounce the operator to the login screen.
  if (auth.initializing) {
    await auth.restore()

    trace('after restore', {
      isAuthenticated: auth.isAuthenticated,
      hasToken: auth.accessToken !== null,
      hasProfile: auth.profile !== null,
    })
  }

  if (to.meta.public === true) {
    // Already signed in and heading for the login page: send them to the dashboard instead.
    if (to.name === 'login' && auth.isAuthenticated) {
      trace('decision', { result: 'redirect to dashboard (already signed in)' })
      return { name: 'dashboard' }
    }

    trace('decision', { result: 'allow (public route)' })
    return true
  }

  if (!auth.isAuthenticated) {
    trace('decision', {
      result: 'BOUNCE to login (not authenticated)',
      hasToken: auth.accessToken !== null,
      hasProfile: auth.profile !== null,
    })

    // Remember where they were going, so signing in lands them there rather than on the dashboard.
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }

  const permission = to.meta.permission

  if (
    permission !== undefined &&
    !hasPermission(permission, {
      isAuthenticated: auth.isAuthenticated,
      isSuperAdmin: auth.isSuperAdmin,
    })
  ) {
    trace('decision', { result: 'FORBIDDEN', permission, isSuperAdmin: auth.isSuperAdmin })
    return { name: 'forbidden' }
  }

  trace('decision', { result: 'allow' })
  return true
})

// A route component that fails to load rejects here rather than in the guard, and vue-router
// reports it through onError - without this it is swallowed and the navigation simply stops.
router.onError((error, to) => {
  console.error('[guard] navigation error', { to: to.fullPath, error })
})

router.afterEach((to, from, failure) => {
  if (failure !== undefined && failure !== null) {
    console.error('[guard] navigation FAILED', { from: from.fullPath, to: to.fullPath, failure })
  } else {
    console.info('[guard] navigated', { from: from.fullPath, to: to.fullPath })
  }
})
