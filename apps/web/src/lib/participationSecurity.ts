const turnstileScriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const clearanceMarkerKey = 'public-office-watch-participation-clearance-v1';
const clearanceMarkerLifetimeMs = 29 * 24 * 60 * 60 * 1000;

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      appearance: 'interaction-only';
      callback(token: string): void;
      'error-callback'(): void;
      'expired-callback'(): void;
    },
  ): string;
  remove(widgetId: string): void;
};

type ParticipationPayload =
  | {
    action: 'region-issue';
    regionId: string;
    issueIds: string[];
  }
  | {
    action: 'person-feedback';
    personId: string;
    feedbackKind: string;
    sectionKey: string;
    problemType?: string;
    message?: string;
    evidenceUrl?: string;
  };

type ParticipationSession = {
  access_token: string;
};

let turnstileScriptPromise: Promise<TurnstileApi> | null = null;
let clearancePromise: Promise<void> | null = null;

function turnstileApi() {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile;
}

function loadTurnstile() {
  const existing = turnstileApi();
  if (existing) return Promise.resolve(existing);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = turnstileScriptUrl;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => {
      const api = turnstileApi();
      if (api) resolve(api);
      else reject(new Error('Turnstile did not initialize'));
    }, { once: true });
    script.addEventListener('error', () => reject(new Error('Turnstile could not be loaded')), { once: true });
    document.head.append(script);
  }).catch((error) => {
    turnstileScriptPromise = null;
    throw error;
  });

  return turnstileScriptPromise;
}

export async function createParticipationCaptchaToken() {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
  if (!siteKey) throw new Error('Turnstile is unavailable');

  const api = await loadTurnstile();
  const container = document.createElement('div');
  container.setAttribute('aria-label', '安全驗證');
  Object.assign(container.style, {
    position: 'fixed',
    left: '50%',
    bottom: '24px',
    transform: 'translateX(-50%)',
    zIndex: '2147483647',
  });
  document.body.append(container);

  return new Promise<string>((resolve, reject) => {
    let widgetId: string | null = null;
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (widgetId) api.remove(widgetId);
      container.remove();
      callback();
    };
    widgetId = api.render(container, {
      sitekey: siteKey,
      action: 'participation',
      appearance: 'interaction-only',
      callback: (token) => finish(() => resolve(token)),
      'error-callback': () => finish(() => reject(new Error('Security verification failed'))),
      'expired-callback': () => finish(() => reject(new Error('Security verification expired'))),
    });
  });
}

function hasClearanceMarker() {
  const value = Number.parseInt(window.localStorage.getItem(clearanceMarkerKey) ?? '', 10);
  return Number.isFinite(value) && value > Date.now();
}

function clearClearanceMarker() {
  window.localStorage.removeItem(clearanceMarkerKey);
}

export async function ensureParticipationClearance() {
  if (hasClearanceMarker()) return;
  if (clearancePromise) return clearancePromise;

  clearancePromise = createParticipationCaptchaToken()
    .then(async (token) => {
      const response = await fetch('/api/participation/challenge', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error('Security verification did not pass');
      window.localStorage.setItem(
        clearanceMarkerKey,
        String(Date.now() + clearanceMarkerLifetimeMs),
      );
    })
    .finally(() => {
      clearancePromise = null;
    });

  return clearancePromise;
}

async function sendParticipationRequest(session: ParticipationSession, payload: ParticipationPayload) {
  return fetch('/api/participation/submit', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      authorization: `Bearer ${session.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function submitParticipationRequest(
  session: ParticipationSession,
  payload: ParticipationPayload,
) {
  await ensureParticipationClearance();
  let response = await sendParticipationRequest(session, payload);

  if (response.status === 403) {
    const result = await response.clone().json().catch(() => null) as { error?: unknown } | null;
    if (result?.error === 'PARTICIPATION_CHALLENGE_REQUIRED') {
      clearClearanceMarker();
      await ensureParticipationClearance();
      response = await sendParticipationRequest(session, payload);
    }
  }

  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof result?.error === 'string' ? result.error : 'Participation request failed');
  }

  return response.json().catch(() => null);
}
