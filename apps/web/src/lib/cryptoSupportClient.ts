import type { SupportInput, SupportNetwork, SupportValidationError } from '../config/cryptoSupport';
import { validateSupportInput } from '../config/cryptoSupport';
import { ensureParticipationClearance } from './participationSecurity';

export class CryptoSupportError extends Error {
  constructor(
    public readonly code: string,
    public readonly field?: SupportValidationError,
  ) {
    super(code);
  }
}

const responseIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function payloadError(result: unknown) {
  if (!result || typeof result !== 'object') return null;
  const value = result as { error?: unknown; field?: unknown };
  return {
    code: typeof value.error === 'string' ? value.error : null,
    field: typeof value.field === 'string' ? value.field as SupportValidationError : undefined,
  };
}

async function send(input: SupportInput) {
  return fetch('/api/participation/support', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

/** Sends a private support message. A server-issued ID is required for success. */
export async function submitCryptoSupport(
  input: SupportInput,
  networks: readonly SupportNetwork[],
): Promise<{ id: string }> {
  const field = validateSupportInput(input, networks);
  if (field) throw new CryptoSupportError('SUPPORT_INVALID', field);

  let response = await send(input);
  let result = await response.clone().json().catch(() => null);
  const firstError = payloadError(result);
  if (response.status === 403 && firstError?.code === 'PARTICIPATION_CHALLENGE_REQUIRED') {
    await ensureParticipationClearance(true);
    response = await send(input);
    result = await response.clone().json().catch(() => null);
  }

  if (!response.ok) {
    const error = payloadError(result);
    throw new CryptoSupportError(error?.code ?? 'SUPPORT_UNAVAILABLE', error?.field);
  }
  if (!result || typeof result !== 'object' || typeof (result as { id?: unknown }).id !== 'string'
    || !responseIdPattern.test((result as { id: string }).id)) {
    throw new CryptoSupportError('SUPPORT_UNAVAILABLE');
  }
  return { id: (result as { id: string }).id };
}
