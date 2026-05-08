import React from 'react';
import Link from 'next/link';
import { getDirectPresetMetadata } from '../../../features/direct/preset-metadata';
import { DirectWalkthroughBanner } from '../direct-walkthrough-banner';
import { ExternalProviderAuthForm } from '../external-provider-auth-form';
import { SignupForm, SignupLaunchPanel } from './signup-form';

type SignupPageProps = {
  searchParams?: Promise<{ fixture?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const showLaunchFixture = resolvedSearchParams.fixture === 'launch';
  const creatorPreset = getDirectPresetMetadata('CREATOR');

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
      {showLaunchFixture ? (
        <SignupLaunchPanel
          email="john@example.com"
          doorSlug="john"
          doorPlan="FREE"
          preset={creatorPreset}
          verificationToken="verify_demo"
        />
      ) : null}
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
