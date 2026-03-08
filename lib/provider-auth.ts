import { createRemoteJWKSet, jwtVerify } from 'jose';

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const linkedInJwks = createRemoteJWKSet(new URL('https://www.linkedin.com/oauth/openid/jwks'));

type ExternalProvider = 'GOOGLE' | 'APPLE' | 'LINKEDIN' | 'PRIVY';

type VerifyProviderTokenInput = {
  provider: ExternalProvider;
  token: string;
};

export type VerifiedExternalIdentity = {
  provider: ExternalProvider;
  providerSubject: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  walletAddress?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required for provider auth`);
  }

  return value;
}

function readStringClaim(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function verifyGoogleToken(token: string): Promise<VerifiedExternalIdentity> {
  const audience = requiredEnv('GOOGLE_OAUTH_CLIENT_ID');

  const { payload } = await jwtVerify(token, googleJwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience
  });

  const providerSubject = readStringClaim(payload.sub);
  if (!providerSubject) {
    throw new Error('Invalid Google token: missing sub');
  }

  const email = readStringClaim(payload.email)?.toLowerCase();
  if (email && payload.email_verified !== true) {
    throw new Error('Google email must be verified');
  }

  return {
    provider: 'GOOGLE',
    providerSubject,
    email,
    emailVerified: Boolean(email),
    name: readStringClaim(payload.name)
  };
}

async function verifyLinkedInToken(token: string): Promise<VerifiedExternalIdentity> {
  const audience = requiredEnv('LINKEDIN_CLIENT_ID');

  const { payload } = await jwtVerify(token, linkedInJwks, {
    issuer: 'https://www.linkedin.com',
    audience
  });

  const providerSubject = readStringClaim(payload.sub);
  if (!providerSubject) {
    throw new Error('Invalid LinkedIn token: missing sub');
  }

  const email = readStringClaim(payload.email)?.toLowerCase();
  if (email && payload.email_verified !== true) {
    throw new Error('LinkedIn email must be verified');
  }

  const givenName = readStringClaim(payload.given_name);
  const familyName = readStringClaim(payload.family_name);
  const name = [givenName, familyName].filter(Boolean).join(' ') || readStringClaim(payload.name);

  return {
    provider: 'LINKEDIN',
    providerSubject,
    email,
    emailVerified: Boolean(email),
    name: name || undefined
  };
}

async function verifyAppleToken(token: string): Promise<VerifiedExternalIdentity> {
  const audience = requiredEnv('APPLE_CLIENT_ID');

  const { payload } = await jwtVerify(token, appleJwks, {
    issuer: 'https://appleid.apple.com',
    audience
  });

  const providerSubject = readStringClaim(payload.sub);
  if (!providerSubject) {
    throw new Error('Invalid Apple token: missing sub');
  }

  const email = readStringClaim(payload.email)?.toLowerCase();
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  if (email && !emailVerified) {
    throw new Error('Apple email must be verified');
  }

  return {
    provider: 'APPLE',
    providerSubject,
    email,
    emailVerified: Boolean(email)
  };
}

type PrivyLinkedAccount = {
  type?: string;
  address?: string;
  email?: string;
  walletAddress?: string;
};

function extractLinkedAccounts(input: unknown): PrivyLinkedAccount[] {
  if (!input || typeof input !== 'object') {
    return [];
  }

  const payload = input as Record<string, unknown>;

  const candidates = [
    payload.linked_accounts,
    payload.linkedAccounts,
    (payload.user as Record<string, unknown> | undefined)?.linked_accounts,
    (payload.user as Record<string, unknown> | undefined)?.linkedAccounts
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is PrivyLinkedAccount => Boolean(item && typeof item === 'object'));
    }
  }

  return [];
}

function extractPrivyIdentity(data: unknown) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid Privy response');
  }

  const payload = data as Record<string, unknown>;
  const providerSubject = readStringClaim(payload.id) ?? readStringClaim((payload.user as { id?: unknown } | undefined)?.id);

  if (!providerSubject) {
    throw new Error('Invalid Privy response: missing user id');
  }

  const linkedAccounts = extractLinkedAccounts(payload);

  const emailAccount = linkedAccounts.find((account) => {
    const type = account.type?.toLowerCase();
    return type?.includes('email') || typeof account.email === 'string';
  });

  const walletAccount = linkedAccounts.find((account) => {
    const type = account.type?.toLowerCase();
    return type?.includes('wallet') || typeof account.address === 'string' || typeof account.walletAddress === 'string';
  });

  const email = readStringClaim(emailAccount?.email)?.toLowerCase();
  const walletAddress =
    readStringClaim(walletAccount?.walletAddress)?.toLowerCase() ||
    readStringClaim(walletAccount?.address)?.toLowerCase();

  return {
    providerSubject,
    email,
    walletAddress
  };
}

async function verifyPrivyToken(token: string): Promise<VerifiedExternalIdentity> {
  const appId = requiredEnv('PRIVY_APP_ID');
  const appSecret = requiredEnv('PRIVY_APP_SECRET');

  const response = await fetch('https://auth.privy.io/api/v1/users/me', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'privy-app-id': appId,
      'privy-app-secret': appSecret
    }
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Privy token verification failed (${response.status}): ${payload}`);
  }

  const data = (await response.json()) as unknown;
  const { providerSubject, email, walletAddress } = extractPrivyIdentity(data);

  return {
    provider: 'PRIVY',
    providerSubject,
    email,
    emailVerified: false,
    walletAddress
  };
}

export async function verifyProviderToken(input: VerifyProviderTokenInput): Promise<VerifiedExternalIdentity> {
  if (!input.token || input.token.trim().length === 0) {
    throw new Error('Token required');
  }

  if (input.provider === 'GOOGLE') {
    return verifyGoogleToken(input.token);
  }

  if (input.provider === 'APPLE') {
    return verifyAppleToken(input.token);
  }

  if (input.provider === 'LINKEDIN') {
    return verifyLinkedInToken(input.token);
  }

  if (input.provider === 'PRIVY') {
    return verifyPrivyToken(input.token);
  }

  throw new Error(`Unsupported provider: ${input.provider}`);
}
