import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { authApi, configureAuth, ApiError } from '@/api'
import type { LoginRequest, OperatorProfile, OperatorRole } from '@/api'

/**
 * The signed-in operator's session.
 *
 * ## What is persisted, and what is not
 *
 * The access token is held in memory only. It is a bearer credential: anything that can read it can
 * act as the operator until it expires, so it is never written to storage where a stray script or
 * another tab could read it back.
 *
 * The refresh token is the one exception, and it is a deliberate trade. Without it in storage, a
 * page reload ends the session and the operator signs in again on every refresh, which is not a
 * usable console. It is kept in sessionStorage rather than localStorage, so it lives only for that
 * browser tab and is gone when the tab closes rather than persisting on a shared machine.
 *
 * Nothing else is persisted: the profile is re-fetched from /me on load, so a stale or tampered
 * copy in storage can never decide what the UI shows. And no token is ever logged - not in an
 * error path, not in development.
 */

const REFRESH_TOKEN_KEY = 'kyc.rt'

function readStoredRefreshToken(): string | null {
  try {
    return window.sessionStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

function writeStoredRefreshToken(token: string | null): void {
  try {
    if (token === null) {
      window.sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    } else {
      window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token)
    }
  } catch {
    // A session that cannot survive a reload is worse UX, not a security problem. Carry on.
  }
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(readStoredRefreshToken())
  const expiresAt = ref<string | null>(null)
  const profile = ref<OperatorProfile | null>(null)

  /** True until the first restore attempt settles, so guards can wait rather than bounce to login. */
  const initializing = ref(true)
  const signingIn = ref(false)

  const isAuthenticated = computed(() => accessToken.value !== null && profile.value !== null)
  const role = computed<OperatorRole | null>(() => profile.value?.role ?? null)
  const isSuperAdmin = computed(() => role.value === 'SuperAdmin')

  function setSession(tokens: { accessToken: string; refreshToken: string; expiresAt: string }) {
    accessToken.value = tokens.accessToken
    refreshToken.value = tokens.refreshToken
    expiresAt.value = tokens.expiresAt
    writeStoredRefreshToken(tokens.refreshToken)
  }

  function clearSession() {
    accessToken.value = null
    refreshToken.value = null
    expiresAt.value = null
    profile.value = null
    writeStoredRefreshToken(null)
  }

  async function loadProfile(): Promise<void> {
    profile.value = await authApi.getProfile()
  }

  async function signIn(credentials: LoginRequest): Promise<void> {
    signingIn.value = true

    try {
      const tokens = await authApi.login(credentials)
      setSession(tokens)

      try {
        await loadProfile()
      } catch (error) {
        // Signed in but the profile did not load: the session is unusable, so do not leave a
        // half-established one behind.
        clearSession()
        throw error
      }
    } finally {
      signingIn.value = false
    }
  }

  /**
   * Exchanges the refresh token for a new pair. Returns the new access token, or null when the
   * session is genuinely over - a spent, expired or revoked token, or a deactivated account.
   *
   * The backend revokes each refresh token as it is used, so a failure here is terminal: the stored
   * token is cleared rather than retried.
   */
  async function refreshSession(): Promise<string | null> {
    const token = refreshToken.value

    if (token === null) return null

    try {
      const tokens = await authApi.refresh({ refreshToken: token })
      setSession(tokens)
      return tokens.accessToken
    } catch {
      clearSession()
      return null
    }
  }

  /**
   * Restores a session on page load from the stored refresh token. Called once at startup.
   */
  async function restore(): Promise<void> {
    try {
      if (refreshToken.value === null) return

      const token = await refreshSession()
      if (token === null) return

      try {
        await loadProfile()
      } catch {
        clearSession()
      }
    } finally {
      initializing.value = false
    }
  }

  /**
   * Signs out. The refresh token is revoked server-side; the access token is self-contained and
   * stays valid until it expires, which is why its lifetime is short.
   *
   * The local session is cleared regardless of what the server says - a network failure must not
   * leave the operator apparently signed in on a machine they have walked away from.
   */
  async function signOut(): Promise<void> {
    const token = refreshToken.value

    try {
      if (token !== null) {
        await authApi.logout({ refreshToken: token })
      }
    } catch {
      // Already expired, already revoked, or unreachable. Clearing locally is what matters.
    } finally {
      clearSession()
    }
  }

  /**
   * Changes the password. The backend rolls the security stamp, which invalidates every token
   * already issued - so the session is over and the operator must sign in again.
   */
  async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await authApi.changePassword({ currentPassword, newPassword })
    clearSession()
  }

  // Wire the HTTP layer to this store. Doing it here keeps the token-handling policy in one place:
  // the client knows how to attach and refresh, and this store decides what a session is.
  configureAuth({
    accessToken: () => accessToken.value,
    refresh: refreshSession,
    onUnauthorized: clearSession,
  })

  return {
    accessToken,
    expiresAt,
    profile,
    initializing,
    signingIn,
    isAuthenticated,
    role,
    isSuperAdmin,
    signIn,
    signOut,
    restore,
    loadProfile,
    changePassword,
    clearSession,
  }
})

/** True when an error is the backend refusing the credentials rather than anything else. */
export function isInvalidCredentials(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}
