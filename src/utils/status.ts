import type { KycStatus, PublicLinkState } from '@/api'

/**
 * One place that decides how a status looks, so no component styles a badge itself.
 *
 * Colour is never the only signal: every badge also carries its localized label, and the ones that
 * matter carry an icon too, so the meaning survives a monochrome screen or colour-blind vision.
 */

export interface StatusStyle {
  /** Tailwind classes for the badge. */
  classes: string
  /** The i18n key for the label. */
  labelKey: string
  /** A dot colour for charts and compact rows. */
  dot: string
  /** The colour used when this status appears in a chart. */
  chart: string
}

export const KYC_STATUS_STYLES: Record<KycStatus, StatusStyle> = {
  Pending: {
    classes:
      'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30',
    labelKey: 'status.Pending',
    dot: 'bg-amber-500',
    chart: '#D97706',
  },
  NoAnswer: {
    classes:
      'bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30',
    labelKey: 'status.NoAnswer',
    dot: 'bg-rose-500',
    chart: '#E0483C',
  },
  InProcess: {
    classes:
      'bg-brand-50 text-brand-800 ring-brand-600/20 dark:bg-brand-400/10 dark:text-brand-200 dark:ring-brand-300/30',
    labelKey: 'status.InProcess',
    dot: 'bg-brand-600',
    chart: '#5C2490',
  },
  Completed: {
    classes:
      'bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30',
    labelKey: 'status.Completed',
    dot: 'bg-emerald-500',
    chart: '#2FAE6A',
  },
}

export const LINK_STATE_STYLES: Record<PublicLinkState, StatusStyle> = {
  Active: {
    classes:
      'bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30',
    labelKey: 'linkState.Active',
    dot: 'bg-emerald-500',
    chart: '#2FAE6A',
  },
  Disabled: {
    classes:
      'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/30',
    labelKey: 'linkState.Disabled',
    dot: 'bg-slate-400',
    chart: '#8A7F95',
  },
  Expired: {
    classes:
      'bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30',
    labelKey: 'linkState.Expired',
    dot: 'bg-rose-500',
    chart: '#E0483C',
  },
}

/**
 * The style for a link state, falling back to a neutral badge for anything unrecognized.
 *
 * A row is styled, never trusted to be styleable: indexing the map directly returns undefined for a
 * value outside the union - an enum the backend serialized as a number, or a state added there
 * before it is added here - and reading a property off that throws inside the render, which takes
 * the whole list down over one bad row. The state still reads correctly either way, because the
 * badge shows the backend's own stateLabel rather than a colour alone.
 */
export function linkStateStyle(state: PublicLinkState): StatusStyle {
  return LINK_STATE_STYLES[state] ?? UNKNOWN_LINK_STATE_STYLE
}

const UNKNOWN_LINK_STATE_STYLE: StatusStyle = {
  classes:
    'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/30',
  labelKey: 'linkState.Disabled',
  dot: 'bg-slate-400',
  chart: '#8A7F95',
}

/** A neutral badge for anything without its own meaning - device type, role, a plain count. */
export const NEUTRAL_BADGE =
  'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/30'

export const ACTIVE_BADGE =
  'bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30'

export const INACTIVE_BADGE =
  'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-400 dark:ring-slate-400/30'

export const DANGER_BADGE =
  'bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30'

/** The chart palette for status distribution, in the order the statuses are presented. */
export const STATUS_CHART_COLORS = [
  KYC_STATUS_STYLES.Pending.chart,
  KYC_STATUS_STYLES.NoAnswer.chart,
  KYC_STATUS_STYLES.InProcess.chart,
  KYC_STATUS_STYLES.Completed.chart,
]
