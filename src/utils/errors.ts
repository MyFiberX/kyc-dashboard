import { ApiError, CanceledError, MALFORMED_RESPONSE } from '@/api'

/**
 * Turns any thrown value into a message the operator should see.
 *
 * The rule is that nothing from the server's internals reaches the screen. The backend's envelope
 * message is written for a caller to read and is safe to show, but only for the statuses where it
 * carries useful, non-sensitive detail - a validation complaint, a conflict explaining why an
 * action was refused. For a 500 the message is replaced with a localized generic one, so a stack
 * trace, a database error or an exception detail can never be rendered even if one arrives.
 */

type Translate = (key: string, named?: Record<string, unknown>) => string

/** Statuses whose server message is safe and useful to show as-is. */
const MESSAGE_WORTH_SHOWING = new Set([400, 403, 404, 409, 422])

export function errorMessage(error: unknown, t: Translate): string {
  if (error instanceof CanceledError) return ''

  if (error instanceof ApiError) {
    // The request succeeded but its body was unusable. Saying "check your connection" here would
    // send the operator looking in the wrong place, so this carries its own message - and the
    // server's own text when it gave one, which is what explains a success:false envelope.
    if (error.status === MALFORMED_RESPONSE) {
      return error.message !== '' ? error.message : t('errors.malformedResponse')
    }

    // No response at all - the request never reached the server.
    if (error.status === 0) return t('errors.network')

    if (MESSAGE_WORTH_SHOWING.has(error.status) && error.message !== '') {
      return error.message
    }

    const key = `errors.${error.status}`
    const translated = t(key)

    // vue-i18n returns the key itself when there is no entry for it.
    if (translated !== key) return translated

    return t('errors.unknown')
  }

  return t('errors.unknown')
}

/** True for the cancellation of a superseded request, which is never worth showing. */
export function isCanceled(error: unknown): boolean {
  return error instanceof CanceledError
}

/** Field-level validation errors, ready to attach to form inputs. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}

  const result: Record<string, string> = {}

  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const first = messages[0]
    if (first !== undefined) result[field] = first
  }

  return result
}

export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.isConflict
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.isNotFound
}

export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.isForbidden
}
