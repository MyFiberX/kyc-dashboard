import { describe, expect, it } from 'vitest'

import { ApiError, CanceledError } from '@/api'
import { errorMessage, fieldErrors, isCanceled, isConflict } from '@/utils/errors'

/**
 * Error handling, with one rule under test above the others: nothing from the server's internals
 * may reach the screen.
 */

/** Stands in for vue-i18n's `t`, which returns the key when there is no message for it. */
const MESSAGES: Record<string, string> = {
  'errors.network': 'Could not reach the server.',
  'errors.401': 'Your session has expired.',
  'errors.403': 'You do not have permission to do that.',
  'errors.429': 'Too many requests.',
  'errors.500': 'The server ran into a problem.',
  'errors.503': 'The service is temporarily unavailable.',
  'errors.unknown': 'Something went wrong.',
}

const t = (key: string) => MESSAGES[key] ?? key

describe('errorMessage', () => {
  it('shows the backend message for a validation failure', () => {
    const error = new ApiError(400, 'The mobile number is not valid.')

    // A 400 explains which field is wrong and why; that is written for a caller to read.
    expect(errorMessage(error, t)).toBe('The mobile number is not valid.')
  })

  it('shows the backend message for a conflict', () => {
    const error = new ApiError(409, 'Campaign has KYC records attributed to it.')

    expect(errorMessage(error, t)).toBe('Campaign has KYC records attributed to it.')
  })

  it('never shows a server-side exception detail on a 500', () => {
    const leak =
      'Npgsql.PostgresException: 23505: duplicate key value violates unique constraint "IX_Kycs_MobileNumber" at Npgsql.NpgsqlConnector.ReadMessage()'

    const message = errorMessage(new ApiError(500, leak), t)

    expect(message).toBe(MESSAGES['errors.500'])
    expect(message).not.toContain('Npgsql')
    expect(message).not.toContain('constraint')
  })

  it('replaces a 503 body with a localized message', () => {
    const message = errorMessage(new ApiError(503, '<html>502 Bad Gateway nginx/1.24.0</html>'), t)

    expect(message).toBe(MESSAGES['errors.503'])
    expect(message).not.toContain('nginx')
  })

  it('reports a request that never reached the server as a network problem', () => {
    expect(errorMessage(new ApiError(0, ''), t)).toBe(MESSAGES['errors.network'])
  })

  it('says nothing about a cancelled request', () => {
    // A superseded search is not a failure the operator should be told about.
    expect(errorMessage(new CanceledError(), t)).toBe('')
    expect(isCanceled(new CanceledError())).toBe(true)
  })

  it('falls back to a generic message for an unrecognised status', () => {
    expect(errorMessage(new ApiError(418, ''), t)).toBe(MESSAGES['errors.unknown'])
  })

  it('falls back to a generic message for a thrown non-error', () => {
    expect(errorMessage('something odd', t)).toBe(MESSAGES['errors.unknown'])
  })
})

describe('fieldErrors', () => {
  it('maps PascalCase validation keys onto camelCase form fields', () => {
    const error = new ApiError(400, 'Validation failed.', {
      mobileNumber: ['The field is required.'],
      fullName: ['Too long.', 'Also invalid.'],
    })

    expect(fieldErrors(error)).toEqual({
      mobileNumber: 'The field is required.',
      fullName: 'Too long.',
    })
  })

  it('returns nothing for an error that carries no field detail', () => {
    expect(fieldErrors(new ApiError(500, 'boom'))).toEqual({})
    expect(fieldErrors(new Error('boom'))).toEqual({})
  })
})

describe('status helpers', () => {
  it('recognises a conflict', () => {
    expect(isConflict(new ApiError(409, ''))).toBe(true)
    expect(isConflict(new ApiError(400, ''))).toBe(false)
  })
})
