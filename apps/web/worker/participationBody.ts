export const participationBodyLimit = 16_384;

export class ParticipationBodyError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(status === 413 ? 'PARTICIPATION_BODY_TOO_LARGE' : 'PARTICIPATION_INVALID_BODY');
    this.status = status;
  }
}

export function checkParticipationLength(value: string | null) {
  if (value === null) return;
  if (!/^\d+$/u.test(value)) throw new ParticipationBodyError(400);
  const length = Number(value);
  if (length > participationBodyLimit) throw new ParticipationBodyError(413);
}

export async function readParticipationBody(request: Request) {
  const reader = request.body?.getReader();
  try {
    checkParticipationLength(request.headers.get('content-length'));
    // Fixed capacity also bounds overhead from arbitrarily many tiny chunks.
    const bytes = new Uint8Array(participationBodyLimit);
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.byteLength > participationBodyLimit - size) throw new ParticipationBodyError(413);
        bytes.set(value, size);
        size += value.byteLength;
      }
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size));
  } catch (error) {
    await reader?.cancel().catch(() => {});
    throw error instanceof ParticipationBodyError ? error : new ParticipationBodyError(400);
  } finally {
    reader?.releaseLock();
  }
}
