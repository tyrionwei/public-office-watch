type MagicLinkInput = {
  email: string;
  options: { emailRedirectTo: string; shouldCreateUser: false; captchaToken: string };
};

type MagicLinkAuth = {
  signInWithOtp(input: MagicLinkInput): Promise<{ error: { code?: string; status?: number } | null }>;
};

export class AdminMagicLinkError extends Error {
  readonly code: 'captcha' | 'rate-limit' | 'send-failed';

  constructor(code: AdminMagicLinkError['code']) {
    super(code);
    this.name = 'AdminMagicLinkError';
    this.code = code;
  }
}

export function adminMagicLinkErrorMessage(error: AdminMagicLinkError) {
  if (error.code === 'captcha') return '安全驗證未完成，請重新操作並完成驗證後再寄送。';
  if (error.code === 'rate-limit') return '登入信件請求過於頻繁或已達寄送上限，請稍後再試。';
  return '登入連結未能寄出，請確認 Email 後再試；若持續失敗，請聯絡網站管理者。';
}

export async function sendAdminMagicLink(
  auth: MagicLinkAuth,
  email: string,
  redirectUrl: string,
  createCaptchaToken: () => Promise<string>,
) {
  let captchaToken: string;
  try {
    captchaToken = await createCaptchaToken();
    if (!captchaToken.trim()) throw new Error('Empty verification token');
  } catch {
    throw new AdminMagicLinkError('captcha');
  }

  try {
    const { error } = await auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectUrl, shouldCreateUser: false, captchaToken },
    });
    if (!error) return;
    if (error.code === 'captcha_failed') throw new AdminMagicLinkError('captcha');
    if (error.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error.code ?? '')) {
      throw new AdminMagicLinkError('rate-limit');
    }
    throw new AdminMagicLinkError('send-failed');
  } catch (error) {
    if (error instanceof AdminMagicLinkError) throw error;
    throw new AdminMagicLinkError('send-failed');
  }
}
