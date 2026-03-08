type SendAuthEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function authEmailFrom() {
  return process.env.AUTH_EMAIL_FROM ?? 'Knokio <no-reply@knokio.io>';
}

function appUrl() {
  return process.env.APP_URL ?? 'http://localhost:3333';
}

export function buildAuthLink(path: string, params: Record<string, string>) {
  const url = new URL(path, appUrl());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function sendViaResend(input: SendAuthEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: authEmailFrom(),
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html
    })
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Resend email delivery failed (${response.status}): ${payload}`);
  }

  return true;
}

export async function sendAuthEmail(input: SendAuthEmailInput) {
  const delivered = await sendViaResend(input);

  if (!delivered) {
    console.info('[auth-email:fallback]', JSON.stringify({
      to: input.to,
      subject: input.subject,
      text: input.text
    }));
  }
}

export async function sendEmailVerificationMail(to: string, token: string) {
  const link = buildAuthLink('/direct/verify-email', { token });
  await sendAuthEmail({
    to,
    subject: 'Verify your Knokio account',
    text: `Verify your email to activate login:\n\n${link}\n\nIf you did not create this account, ignore this email.`
  });
}

export async function sendPasswordResetMail(to: string, token: string) {
  const link = buildAuthLink('/direct/reset-password', { token });
  await sendAuthEmail({
    to,
    subject: 'Reset your Knokio password',
    text: `Reset your password using this secure link:\n\n${link}\n\nIf you did not request this, ignore this email.`
  });
}
