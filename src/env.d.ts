/// <reference types="vite/client" />

/**
 * Only public configuration belongs here. Everything in a VITE_ variable is compiled into the
 * bundle and readable by anyone who opens the page, so no secret - an API client key above all -
 * may ever be introduced as one.
 */
interface ImportMetaEnv {
  /** Absolute base URL of the API. Empty for same-origin, which is the default. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
