import React from 'react';
import Link from 'next/link';
import { DirectWalkthroughBanner } from '../direct-walkthrough-banner';
import { ExternalProviderAuthForm } from '../external-provider-auth-form';
import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <main>
      <h1>Create Keeper account</h1>
      <p>Create your account and first Knokio Direct door.</p>
      <p>
        Direct is built to keep your private inbox private while still letting serious requests reach you through a
        structured, controlled door.
      </p>
      <p>
        Start on Free, then upgrade after billing is active when you want paid request lanes, more doors, or more
        capacity.
      </p>
      <DirectWalkthroughBanner currentStep="signup" />
      <SignupForm />
      <ExternalProviderAuthForm mode="signup" />
      <p>
        Already have an account? <Link href="/direct/login">Sign in</Link>
      </p>
      <p>
        Already have a verification token? <Link href="/direct/verify-email">Verify email</Link>
      </p>
    </main>
  );
}
